import React, { ChangeEvent } from 'react';
import { InlineSwitch, QueryField } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from '../datasource';
import { MyDataSourceOptions, MyQuery } from '../types';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

function cleanMultilineString(str: string) {
  return str.replace(/\n\s+/g, '\n').trim();
}

export function QueryEditor({ query, onChange, onRunQuery }: Props) {
  const onQueryTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, queryText: event.target.value });
  };
  const onLongFormatChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, long: event.target.checked });
    onRunQuery();
  }
  const { queryText, long } = query;

  const dummyQuery = cleanMultilineString(`
    select
      current_date() - to_days(n::int) as timestamp,
      case when n % 2 = 0 then 'btc' else 'eth' end as segment,
      random() * 100 as target
    from generate_series(1, 100) tbl(n);
  `);

  if (!queryText) {
    onChange({ ...query, queryText: dummyQuery, long: true});
    onRunQuery();
  }

  return (
    <div className="gf-form">
      <div>
        <QueryField query={queryText || dummyQuery} onChange={onQueryTextChange} />
      </div>
      <div>
        <InlineSwitch label="Long Format" showLabel={true} value={long} transparent={false} onChange={onLongFormatChange}/>
      </div>
    </div>
  );
}
