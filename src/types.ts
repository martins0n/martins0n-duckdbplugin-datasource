import { DataQuery, DataSourceJsonData } from '@grafana/schema';

export interface MyQuery extends DataQuery {
  queryText?: string;
  long?: boolean;
}


/**
 * These are options configured for each DataSource instance
 */

export interface DataFrameLink {
    url: string;
    alias: string;
    id: number;
}
export interface MyDataSourceOptions extends DataSourceJsonData {
  dataFrames?: DataFrameLink[];
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  apiKey?: string;
}
