output "ses_identity_arn" {
  description = "The mail_domain SES identity; the API task role may send as it."
  value       = aws_sesv2_email_identity.mail.arn
}

output "ses_configuration_set_name" {
  description = "The SES configuration set that publishes bounce and complaint events (SES_CONFIGURATION_SET)."
  value       = aws_sesv2_configuration_set.this.configuration_set_name
}

output "ses_events_topic_arn" {
  description = "The SNS topic the SES webhook accepts events from (SES_SNS_TOPIC_ARN)."
  value       = aws_sns_topic.ses_events.arn
}

output "ses_webhook_endpoint" {
  description = "Where the SNS subscription delivers SES bounce and complaint events (the API's webhook)."
  value       = aws_sns_topic_subscription.webhook.endpoint
}
