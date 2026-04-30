// Minimal alerting baseline for the API App Service.
// Deployed only when appServicePlanSkuName is B1 or above (Free tier lacks health check metrics).
// Alerts fire in Azure Monitor regardless of email configuration.
// Set alertEmail to also receive email notifications.
param apiAppServiceResourceId string
param location string
param tags object = {}

@description('Optional email address for alert notifications. Leave empty for portal-only alerts.')
param alertEmail string = ''

var hasEmail = !empty(alertEmail)

resource actionGroup 'microsoft.insights/actiongroups@2023-01-01' = {
  name: 'ag-dales-ops'
  location: 'global'
  tags: tags
  properties: {
    groupShortName: 'DalesOps'
    enabled: true
    emailReceivers: hasEmail ? [
      {
        name: 'ops-email'
        emailAddress: alertEmail
        useCommonAlertSchema: true
      }
    ] : []
  }
}

// Fires when the API returns more than 5 HTTP 5xx responses in a 5-minute window.
resource alert5xx 'microsoft.insights/metricAlerts@2018-03-01' = {
  name: 'alert-api-5xx'
  location: 'global'
  tags: tags
  properties: {
    description: 'API returned more than 5 HTTP 5xx responses in a 5-minute window.'
    severity: 2
    enabled: true
    scopes: [ apiAppServiceResourceId ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'Http5xx'
          metricName: 'Http5xx'
          operator: 'GreaterThan'
          threshold: 5
          timeAggregation: 'Total'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [ { actionGroupId: actionGroup.id } ]
  }
}

// Fires when App Service marks the /health endpoint as unhealthy.
// HealthCheckStatus = 100 means healthy; anything below means one or more instances failed.
resource alertHealthCheck 'microsoft.insights/metricAlerts@2018-03-01' = {
  name: 'alert-api-health'
  location: 'global'
  tags: tags
  properties: {
    description: 'API App Service health check (/health) is reporting unhealthy.'
    severity: 1
    enabled: true
    scopes: [ apiAppServiceResourceId ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'HealthCheckStatus'
          metricName: 'HealthCheckStatus'
          operator: 'LessThan'
          threshold: 100
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [ { actionGroupId: actionGroup.id } ]
  }
}
