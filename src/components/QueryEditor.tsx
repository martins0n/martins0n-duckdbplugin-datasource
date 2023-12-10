import React from 'react';
import { QueryField } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from '../datasource';
import { MyDataSourceOptions, MyQuery } from '../types';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

function cleanMultilineString(str: string) {
  return str.replace(/\n\s+/g, '\n').trim();
}

export function QueryEditor({ query, onChange, onRunQuery }: Props) {
  const onQueryTextChange = (event: string) => {
    onChange({ ...query, queryText: event });
  };

  const { queryText } = query;

  const dummyQuery = cleanMultilineString(`
    select
      current_date() - to_days(n::int) as timestamp,
      case when n % 2 = 0 then 'btc' else 'eth' end as segment,
      random() * 100 as target
    from generate_series(1, 100) tbl(n);
  `);

  if (!queryText) {
    onChange({ ...query, queryText: dummyQuery});
    onRunQuery();
  }

  return (
    <div className="gf-form" style={{ height: '100%', width: '100%' }}>
      <div style={{ height: '100%', width: '100%' }}>
        <QueryField query={queryText || dummyQuery} onChange={onQueryTextChange} portalOrigin={''} />
      </div>
    </div>
  );
}
