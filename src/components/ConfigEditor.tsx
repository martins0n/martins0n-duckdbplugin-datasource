import React, { ChangeEvent } from 'react';
import { InlineField, Input, SecretInput, InlineFieldRow, Button} from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { MyDataSourceOptions, MySecureJsonData } from '../types';


interface Props extends DataSourcePluginOptionsEditorProps<MyDataSourceOptions> { }

export function ConfigEditor(props: Props) {
  const { onOptionsChange, options } = props;

  // create form with list of fields

  console.log(options);

  const parsedOptions = options.jsonData.dataFrames || [{ id: 1, url: '', alias: '' }]

  console.log(parsedOptions);

  const onURLChange = (id: number, value: string) => {
    const newOptions = parsedOptions.map((option) => {
      if (option.id === id) {
        return { ...option, url: value };
      }
      return option;
    });
    const jsonData = { ...options.jsonData, dataFrames: newOptions };
    onOptionsChange({ ...options, jsonData });
  }

  const onAliasChange = (id: number, value: string) => {
    const newOptions = parsedOptions.map((option) => {
      if (option.id === id) {
        return { ...option, alias: value };
      }
      return option;
    });
    const jsonData = { ...options.jsonData, dataFrames: newOptions };
    onOptionsChange({ ...options, jsonData });
  }



  return (
    <div>
      {parsedOptions.map((option) => (
        <InlineFieldRow>
        <InlineField label={'URL'}>
            <Input label={'URL'} value={option.url} onChange={(event) => onURLChange(option.id, event.target.value)}/>
        </InlineField>
        <InlineField label={'Alias'}>
        <Input label={'alias'} value={option.alias} onChange={(event) => onAliasChange(option.id, event.target.value)}/>
        </InlineField>
        </InlineFieldRow>
      ))}
      <Button onClick={() => {
        parsedOptions.push({ id: parsedOptions.length + 1, url: '', alias: '' });
        const jsonData = { ...options.jsonData, dataFrames: parsedOptions };
        onOptionsChange({ ...options, jsonData });
      }}>Add</Button>
      <Button onClick={() => {
        parsedOptions.pop();
        const jsonData = { ...options.jsonData, dataFrames: parsedOptions };
        onOptionsChange({ ...options, jsonData });
      } }>Remove</Button>
    </div>
  );
}