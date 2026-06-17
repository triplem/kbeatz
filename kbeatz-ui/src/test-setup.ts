import '@testing-library/jest-dom'
import { configure } from '@testing-library/dom'
import './lib/i18n'

// The suite now includes CPU-heavy axe accessibility checks (#832) that run
// concurrently with the rest. Under that load the default 1000ms async-query
// timeout is too tight and causes spurious findBy/waitFor timeouts. Raise it so
// query timeouts reflect genuine failures, not scheduler starvation.
configure({ asyncUtilTimeout: 10000 })
