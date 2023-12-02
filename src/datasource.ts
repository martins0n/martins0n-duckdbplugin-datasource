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

// @ts-ignore
let db: duckdb.DuckDB | null = null;

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
    this.init();
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
    console.log(this)
    const { range } = options;
    const from = range!.from.toISOString();
    const to = range!.to.toISOString();

    if (!this.db) {
      await this.init();
    }
    const c = await this.db.connect();

    let timestampFilter = '';
    if (from) {
        timestampFilter += ` and timestamp >= '${from}'`;
    }
    if (to) {
        timestampFilter += ` and timestamp <= '${to}'`;
    }


    async function dataPrepare(targets: MyQuery[]){
      const query = targets[0].queryText;
      let result = await c.query(`
        ${query}
        WHERE 1=1
          ${timestampFilter}
      `);
      result = result.toArray().map((row) => row.toJSON());
      const grouped = {};

      result.forEach(item => {
        if (!grouped[item.segment]) {
          grouped[item.segment] = { timestamp: [], segment: item.segment, target: [] };
        }
        grouped[item.segment].timestamp.push(item.timestamp);
        grouped[item.segment].target.push(item.target);
      });

      return Object.values(grouped);

    }

    const result = await dataPrepare(options.targets);


    console.log('result', result);

    
    console.log('result', result);
    // Return a constant for each query.
    console.log('query', options);

    const data = result.map((target) => {
      return new MutableDataFrame({
        refId: target.segment,

        fields: [
          // @ts-ignore
          { name: 'Time', values: target.timestamp, type: FieldType.time },
          // @ts-ignore
          { name: target.segment, values: target.target, type: FieldType.number },
          // @ts-ignore
        ]
      });
    });

    await c.close();

    console.log('data', data);


    return { data };
  }

  async testDatasource() {
    // Implement a health check for your data source.
    return {
      status: 'success',
      message: 'Success',
    };
  }
}
