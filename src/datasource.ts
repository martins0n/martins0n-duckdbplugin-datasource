import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
} from '@grafana/data';

import { MyQuery, MyDataSourceOptions, DataFrameLink } from './types';

import * as duckdb from '@duckdb/duckdb-wasm';

// @ts-ignore
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm';
// @ts-ignore
import duckdb_wasm_next from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm';

async function createDuckDB() {
  console.log('createDuckDB');

  const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
    mvp: {
      mainModule: duckdb_wasm,
      mainWorker: new URL('@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js', import.meta.url).toString(),
    },
    eh: {
      mainModule: duckdb_wasm_next,
      mainWorker: new URL('@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js', import.meta.url).toString(),
    },
  };
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
  // Instantiate the asynchronus version of DuckDB-Wasm
  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
  console.log("DuckDB-Wasm instantiated!");
  return db;
}

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {

  dataFrames: DataFrameLink[];
  db: duckdb.DuckDB;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    this.dataFrames = instanceSettings.jsonData.dataFrames || [];
  }

  async init() {
    this.db = await createDuckDB();
    await this.createTables();
  }

  async createTables() {
    if (!this.db) {
      await this.init();
    }
    const c = await this.db.connect();

    for (const dataFrame of this.dataFrames) {
      await c.query(`
        CREATE TABLE IF NOT EXISTS '${dataFrame.alias}'
        AS (SELECT * FROM '${dataFrame.url}')
      `);
    }
    await c.close();
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    if (!this.db) {
      await this.init();
    }
    const c = await this.db.connect();

    const data = await this.createRawDataFrames(c, options.targets);
    await c.close();
    return { data };
  }

  async createRawDataFrames(c, targets: MyQuery[]) {
    let dataFrames = [];
    for (const target of targets) {
      const query = target.queryText;
      const result = await c.query(`
        ${query}
      `);
      const data = result.toArray()
      const grouped = {};
      data.forEach(item => {
        let value = item.toJSON();
        for (const key of Object.keys(value)) {
          if (!grouped[key]) {
            grouped[key] = [];
          }
          grouped[key].push(value[key]);
        }
      }
      )
      dataFrames.push(new MutableDataFrame({
        refId: target.refId,
        fields: Object.keys(grouped).map((key) => {
          return { name: key, values: grouped[key] };
        })
      }));

    }
    return dataFrames;
  }

  async createPivotDataFrames(c, targets: MyQuery[]) {
    let dataFrames = [];
    for (const target of targets) {
      const query = target.queryText;
      const result = await c.query(`
        ${query}
      `);
      const data = result.toArray().map((row) => row.toJSON());
      const grouped = {};

      data.forEach(item => {
        if (!grouped[item.segment]) {
          grouped[item.segment] = { timestamp: [], segment: item.segment, target: [] };
        }
        grouped[item.segment].timestamp.push(item.timestamp);
        grouped[item.segment].target.push(item.target);
      });
      
      Object.values(grouped).forEach((x) => {
        dataFrames.push(new MutableDataFrame({
          refId: target.refId,
          fields: [
            // @ts-ignore
            { name: 'timestamp', values: x.timestamp, type: FieldType.time },
            // @ts-ignore
            { name: x.segment, values: x.target, type: FieldType.number },
            // @ts-ignore
          ]
        }));
      }
      );
    }
    return dataFrames;
  }
}
