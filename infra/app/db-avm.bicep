param accountName string
param location string = resourceGroup().location
param tags object = {}
param cosmosDatabaseName string = ''

// Default containers for Dales Operations — one per domain collection
param containers array = [
  {
    name: 'employees'
    paths: [ '/id' ]
  }
  {
    name: 'tasks'
    paths: [ '/id' ]
  }
  {
    name: 'productivity'
    paths: [ '/id' ]
  }
  {
    name: 'coaching'
    paths: [ '/id' ]
  }
  {
    name: 'issues'
    paths: [ '/id' ]
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
