#!/usr/bin/env node
import { generate } from 'openapi-typescript-codegen'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

await generate({
  input: resolve(root, '../kbeatz-catalog/api/openapi.yaml'),
  output: resolve(root, 'src/api/generated'),
  httpClient: 'axios',
  useOptions: true,
  useUnionTypes: true,
})

console.log('API client generated successfully.')
