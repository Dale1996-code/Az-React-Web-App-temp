targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the the environment which is used to generate a short unique hash used in all resources.')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

// Optional parameters to override the default azd resource naming conventions. Update the main.parameters.json file to provide values. e.g.,:
// "resourceGroupName": {
//      "value": "myGroupName"
// }
param apiServiceName string = ''
param applicationInsightsDashboardName string = ''
param applicationInsightsName string = ''
param appServicePlanName string = ''
param cosmosAccountName string = ''
param keyVaultName string = ''
param logAnalyticsName string = ''
param resourceGroupName string = ''
param webServiceName string = ''
param apimServiceName string = ''

@description('Flag to use Azure API Management to mediate the calls between the Web frontend and the backend API')
param useAPIM bool = false

@description('API Management SKU to use if APIM is enabled')
param apimSku string = 'Consumption'

@description('Id of the user or app to assign application roles')
param principalId string = ''

@description('App Service Plan SKU name. F1 (Free) is the default so the template deploys on quota-constrained subscriptions (e.g. Azure Free with Basic VM quota = 0); when F1 is chosen, alwaysOn and healthCheckPath are automatically disabled because the Free tier does not support them. Use B1+ when quota allows and alwaysOn is required.')
@allowed(['F1', 'B1', 'B2', 'B3', 'S1', 'S2', 'S3', 'P1v3', 'P2v3', 'P3v3'])
param appServicePlanSkuName string = 'F1'

@description('Optional email address to receive alert notifications (5xx spike, health check failure). Leave empty to suppress email — alerts still fire in Azure Monitor. Only applied when appServicePlanSkuName is B1 or above.')
param alertEmail string = ''

var abbrs = loadJsonContent('./abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = { 'azd-env-name': environmentName }

// Derive App Service Plan tier from SKU name so callers only need to set one parameter.
var appServicePlanSkuTierMap = {
  F1: 'Free'
  B1: 'Basic'
  B2: 'Basic'
  B3: 'Basic'
  S1: 'Standard'
  S2: 'Standard'
  S3: 'Standard'
  P1v3: 'PremiumV3'
  P2v3: 'PremiumV3'
  P3v3: 'PremiumV3'
}
var appServicePlanSkuTier = appServicePlanSkuTierMap[appServicePlanSkuName]
var isFreeTier = appServicePlanSkuTier == 'Free'

// Organize resources in a resource group
resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: !empty(resourceGroupName) ? resourceGroupName : '${abbrs.resourcesResourceGroups}${environmentName}'
  location: location
  tags: tags
}

// The application frontend
module web './app/web-appservice-avm.bicep' = {
  name: 'web'
  scope: rg
  params: {
    name: !empty(webServiceName) ? webServiceName : '${abbrs.webSitesAppService}web-${resourceToken}'
    location: location
    tags: tags
    appServicePlanId: appServicePlan.outputs.resourceId
    appInsightResourceId: monitoring.outputs.applicationInsightsResourceId
    linuxFxVersion: 'node|22-lts'
    alwaysOn: !isFreeTier
  }
}

// The application backend
module api './app/api-appservice-avm.bicep' = {
  name: 'api'
  scope: rg
  params: {
    name: !empty(apiServiceName) ? apiServiceName : '${abbrs.webSitesAppService}api-${resourceToken}'
    location: location
    tags: tags
    kind: 'app'
    appServicePlanId: appServicePlan.outputs.resourceId
    siteConfig: union(
      {
        alwaysOn: !isFreeTier
        linuxFxVersion: 'node|22-lts'
      },
      isFreeTier ? {} : { healthCheckPath: '/health' }
    )
    appSettings: {
      AZURE_KEY_VAULT_ENDPOINT: keyVault.outputs.uri
      AZURE_COSMOS_DATABASE_NAME: cosmos.outputs.databaseName
      AZURE_COSMOS_ENDPOINT: cosmos.outputs.endpoint
      API_ALLOW_ORIGINS: web.outputs.SERVICE_WEB_URI
      SCM_DO_BUILD_DURING_DEPLOYMENT: false
      // NODE_ENV, AZURE_AD_TENANT_ID, and AZURE_AD_CLIENT_ID are intentionally
      // absent here. Auth enforcement is bypassed in the MVP phase because the
      // React frontend does not yet have MSAL integrated (Phase 2 prerequisite).
      // Setting NODE_ENV=production before MSAL is wired will return 401 on
      // every frontend API call. See README.md#authentication for the full
      // production hardening checklist and the correct sequencing.
    }
    appInsightResourceId: monitoring.outputs.applicationInsightsResourceId
    allowedOrigins: [ web.outputs.SERVICE_WEB_URI ]
  }
}

// Give the API access to KeyVault
module accessKeyVault 'br/public:avm/res/key-vault/vault:0.3.5' = {
  name: 'accesskeyvault'
  scope: rg
  params: {
    name: keyVault.outputs.name
    enableRbacAuthorization: false
    enableVaultForDeployment: false
    enableVaultForTemplateDeployment: false
    enablePurgeProtection: false
    sku: 'standard'
    accessPolicies: [
      {
        objectId: principalId
        permissions: {
          secrets: [ 'get', 'list' ]
        }
      }
      {
        objectId: api.outputs.SERVICE_API_IDENTITY_PRINCIPAL_ID
        permissions: {
          secrets: [ 'get', 'list' ]
        }
      }
    ]
  }
}

// The application database
module cosmos './app/db-avm.bicep' = {
  name: 'cosmos'
  scope: rg
  params: {
    accountName: !empty(cosmosAccountName) ? cosmosAccountName : '${abbrs.documentDBDatabaseAccounts}${resourceToken}'
    location: location
    tags: tags
  }
}

// Give the API managed identity access to Cosmos DB using built-in Data Contributor role
module apiCosmosRoleAssignment './app/cosmos-role-assignment.bicep' = {
  name: 'api-cosmos-role'
  scope: rg
  params: {
    cosmosAccountName: cosmos.outputs.accountName
    apiPrincipalId: api.outputs.SERVICE_API_IDENTITY_PRINCIPAL_ID
  }
}

// Create an App Service Plan to group applications under the same payment plan and SKU
module appServicePlan 'br/public:avm/res/web/serverfarm:0.1.0' = {
  name: 'appserviceplan'
  scope: rg
  params: {
    name: !empty(appServicePlanName) ? appServicePlanName : '${abbrs.webServerFarms}${resourceToken}'
    sku: {
      name: appServicePlanSkuName
      tier: appServicePlanSkuTier
    }
    location: location
    tags: tags
    reserved: true
    kind: 'Linux'
  }
}

// Create a keyvault to store secrets
module keyVault 'br/public:avm/res/key-vault/vault:0.3.5' = {
  name: 'keyvault'
  scope: rg
  params: {
    name: !empty(keyVaultName) ? keyVaultName : '${abbrs.keyVaultVaults}${resourceToken}'
    location: location
    tags: tags
    enableRbacAuthorization: false
    enableVaultForDeployment: false
    enableVaultForTemplateDeployment: false
    enablePurgeProtection: false
    sku: 'standard'
  }
}

// Monitor application with Azure Monitor
module monitoring 'br/public:avm/ptn/azd/monitoring:0.1.0' = {
  name: 'monitoring'
  scope: rg
  params: {
    applicationInsightsName: !empty(applicationInsightsName) ? applicationInsightsName : '${abbrs.insightsComponents}${resourceToken}'
    logAnalyticsName: !empty(logAnalyticsName) ? logAnalyticsName : '${abbrs.operationalInsightsWorkspaces}${resourceToken}'
    applicationInsightsDashboardName: !empty(applicationInsightsDashboardName) ? applicationInsightsDashboardName : '${abbrs.portalDashboards}${resourceToken}'
    location: location
    tags: tags
  }
}
// Minimal alerting baseline — Http5xx spike and health check failure.
// Skipped on Free tier because HealthCheckStatus metric requires Basic or above.
module alerts './app/alerts.bicep' = if (!isFreeTier) {
  name: 'alerts'
  scope: rg
  params: {
    apiAppServiceResourceId: '${rg.id}/providers/Microsoft.Web/sites/${api.outputs.SERVICE_API_NAME}'
    location: location
    tags: tags
    alertEmail: alertEmail
  }
}

// Creates Azure API Management (APIM) service to mediate the requests between the frontend and the backend API
module apim 'br/public:avm/res/api-management/service:0.2.0' = if (useAPIM) {
  name: 'apim-deployment'
  scope: rg
  params: {
    name: !empty(apimServiceName) ? apimServiceName : '${abbrs.apiManagementService}${resourceToken}'
    publisherEmail: 'noreply@microsoft.com'
    publisherName: 'n/a'
    location: location
    tags: tags
    sku: apimSku
    skuCount: 0
    zones: []
    customProperties: {}
    loggers: [
      {
        name: 'app-insights-logger'
        credentials: {
          instrumentationKey: monitoring.outputs.applicationInsightsInstrumentationKey
        }
        loggerDescription: 'Logger to Azure Application Insights'
        isBuffered: false
        loggerType: 'applicationInsights'
        targetResourceId: monitoring.outputs.applicationInsightsResourceId
      }
    ]
  }
}

//Configures the API settings for an api app within the Azure API Management (APIM) service.
module apimApi 'br/public:avm/ptn/azd/apim-api:0.1.0' = if (useAPIM) {
  name: 'apim-api-deployment'
  scope: rg
  params: {
    apiBackendUrl: api.outputs.SERVICE_API_URI
    apiDescription: 'Dales Operations API'
    apiDisplayName: 'Dales Operations API'
    apiName: 'dales-operations-api'
    apiPath: 'dales-operations'
    name: useAPIM ? apim.outputs.name : ''
    webFrontendUrl: web.outputs.SERVICE_WEB_URI
    location: location
    apiAppName: api.outputs.SERVICE_API_NAME
  }
}

// Data outputs
output AZURE_COSMOS_DATABASE_NAME string = cosmos.outputs.databaseName
output AZURE_COSMOS_ENDPOINT string = cosmos.outputs.endpoint

// App outputs
output APPLICATIONINSIGHTS_CONNECTION_STRING string = monitoring.outputs.applicationInsightsConnectionString
output AZURE_KEY_VAULT_ENDPOINT string = keyVault.outputs.uri
output AZURE_KEY_VAULT_NAME string = keyVault.outputs.name
output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = tenant().tenantId
output API_BASE_URL string = useAPIM ? apimApi.outputs.serviceApiUri : api.outputs.SERVICE_API_URI
output REACT_APP_WEB_BASE_URL string = web.outputs.SERVICE_WEB_URI
output USE_APIM bool = useAPIM
output SERVICE_API_ENDPOINTS array = useAPIM ? [ apimApi.outputs.serviceApiUri, api.outputs.SERVICE_API_URI ]: []

// Surfaced so the post-provision Entra ID app-settings step in README.md
// (`az webapp config appsettings set --name $SERVICE_API_NAME ...`) is
// copy-pasteable without portal lookups.
output SERVICE_API_NAME string = api.outputs.SERVICE_API_NAME
output AZURE_RESOURCE_GROUP string = rg.name
