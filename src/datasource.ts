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
  console.log('DuckDB-Wasm is loading...');

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
  // @ts-ignore
  static db: duckdb.DuckDB = null;
  static isDbInitializing = false;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    this.dataFrames = instanceSettings.jsonData.dataFrames || [];
  }

  async createConnectionAndTables() {
    if (!DataSource.db) {
      if (!DataSource.isDbInitializing) {
        DataSource.isDbInitializing = true;
        DataSource.db = await createDuckDB();
        try {
          await this.createTables();
        } catch (e) {
          DataSource.db = null;
          console.error(e);
        }
        DataSource.isDbInitializing = false;
      } else {
        while (!DataSource.db) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    }
  }

  async createTables() {
    if (!DataSource.db) {
      await this.createConnectionAndTables();
    }
    const c = await DataSource.db.connect();

    let errors = [];
    for (const dataFrame of this.dataFrames) {
      try{
        await c.query(`
          CREATE TABLE IF NOT EXISTS '${dataFrame.alias}'
          AS (SELECT * FROM '${dataFrame.url}')
        `);
      } catch (e) {
        console.error(e);
        errors.push(e);
      }
    }
    if (errors.length > 0) {
      throw errors;
    }
    await c.close();
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    if (!DataSource.db) {
      await this.createConnectionAndTables();
    }
    const c = await DataSource.db.connect();

    const data = await this.createRawDataFrames(c, options.targets);
    await c.close();
    return { data };
  }

  async createRawDataFrames(c: any, targets: MyQuery[]) {
    let dataFrames = [];
    for (const target of targets) {
      const query = target.queryText;
      const result = await c.query(`
        ${query}
      `);
      const data = result.toArray()
      const grouped = {};
      // @ts-ignore
      data.forEach(item => {
        let value = item.toJSON();
        for (const key of Object.keys(value)) {
          // @ts-ignore
          if (!grouped[key]) {
            // @ts-ignore
            grouped[key] = [];
          }
          // @ts-ignore
          grouped[key].push(value[key]);
        }
      }
      )
      dataFrames.push(new MutableDataFrame({
        refId: target.refId,
        fields: Object.keys(grouped).map((key) => {
          // @ts-ignore
          return { name: key, values: grouped[key] };
        })
      }));

    }
    return dataFrames;
  }

  async createPivotDataFrames(c: any, targets: MyQuery[]) {
    // @ts-ignore
    let dataFrames = [];
    for (const target of targets) {
      const query = target.queryText;
      const result = await c.query(`
        ${query}
      `);
      // @ts-ignore
      const data = result.toArray().map((row) => row.toJSON());
      const grouped = {};
      // @ts-ignore
      data.forEach(item => {
        // @ts-ignore
        if (!grouped[item.segment]) {
          // @ts-ignore
          grouped[item.segment] = { timestamp: [], segment: item.segment, target: [] };
        }
        // @ts-ignore
        grouped[item.segment].timestamp.push(item.timestamp);
        // @ts-ignore
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
    // @ts-ignore
    return dataFrames;
  }

  async testDatasource() {
    if (!DataSource.db) {
      await this.createConnectionAndTables();
    }
    const c = await DataSource.db.connect();
    await c.close();
    return {
      status: 'success',
      message: 'Success',
    };
  }
}
