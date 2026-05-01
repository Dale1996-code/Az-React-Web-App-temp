param accountName string
param location string = resourceGroup().location
param tags object = {}
param cosmosDatabaseName string = ''

// ---------------------------------------------------------------------------
// Container definitions with indexing policies
//
// Why composite indexes?
// All containers use /id as the partition key, so every cross-partition query
// (i.e. almost every query) that combines a WHERE clause with ORDER BY on a
// different field requires a composite index. Without them, Cosmos DB returns
// a "cross partition ORDER BY" error at runtime.
//
// Affected dashboard queries:
//   issues:   WHERE status='open'          ORDER BY storeDate DESC
//   coaching: WHERE followUpDate <= @date  ORDER BY followUpDate ASC
//
// The default indexing policy already indexes every field individually via
// includedPaths: [/*], so single-field WHERE clauses need no extra indexes.
// Only the combined filter+orderBy patterns require explicit composite entries.
//
// Pagination note: OFFSET/LIMIT is used for server-side pagination. For large
// collections, continuation tokens (FeedOptions.continuationToken) scale better
// and avoid re-scanning skipped rows on each page. Switch when any collection
// regularly exceeds a few thousand documents.
// ---------------------------------------------------------------------------

var issuesIndexingPolicy = {
  automatic: true
  indexingMode: 'consistent'
  includedPaths: [
    { path: '/*' }
  ]
  excludedPaths: [
    { path: '/"_etag"/?' }
  ]
  // Dashboard: recent open issues ordered newest-first
  compositeIndexes: [
    [
      { path: '/status',    order: 'ascending'  }
      { path: '/storeDate', order: 'descending' }
    ]
  ]
}

var coachingIndexingPolicy = {
  automatic: true
  indexingMode: 'consistent'
  includedPaths: [
    { path: '/*' }
  ]
  excludedPaths: [
    { path: '/"_etag"/?' }
  ]
  // Dashboard: overdue follow-ups ordered oldest-first
  compositeIndexes: [
    [
      { path: '/followUpDate', order: 'ascending' }
    ]
  ]
}

var tasksIndexingPolicy = {
  automatic: true
  indexingMode: 'consistent'
  includedPaths: [
    { path: '/*' }
  ]
  excludedPaths: [
    { path: '/"_etag"/?' }
  ]
  // Route: filter by date + status (common combined filter in TasksPage)
  compositeIndexes: [
    [
      { path: '/storeDate', order: 'ascending' }
      { path: '/status',    order: 'ascending' }
    ]
    [
      { path: '/storeDate',   order: 'ascending' }
      { path: '/department',  order: 'ascending' }
    ]
  ]
}

// Default containers for Dales Operations — one per domain collection
param containers array = [
  {
    name: 'employees'
    paths: [ '/id' ]
  }
  {
    name: 'tasks'
    paths: [ '/id' ]
    indexingPolicy: tasksIndexingPolicy
  }
  {
    name: 'productivity'
    paths: [ '/id' ]
  }
  {
    name: 'coaching'
    paths: [ '/id' ]
    indexingPolicy: coachingIndexingPolicy
  }
  {
    name: 'issues'
    paths: [ '/id' ]
    indexingPolicy: issuesIndexingPolicy
  }
  {
    name: 'summaries'
    paths: [ '/id' ]
  }
]

var defaultDatabaseName = 'DalesOperations'
var actualDatabaseName = !empty(cosmosDatabaseName) ? cosmosDatabaseName : defaultDatabaseName

module cosmos 'br/public:avm/res/document-db/database-account:0.6.0' = {
  name: 'cosmos-sql'
  params: {
    locations: [
      {
        failoverPriority: 0
        isZoneRedundant: false
        locationName: location
      }
    ]
    name: accountName
    location: location
    disableLocalAuth: true
    sqlDatabases: [
      {
        name: actualDatabaseName
        tags: tags
        containers: containers
      }
    ]
  }
}

output databaseName string = actualDatabaseName
output endpoint string = cosmos.outputs.endpoint
output accountName string = accountName
output resourceId string = cosmos.outputs.resourceId
