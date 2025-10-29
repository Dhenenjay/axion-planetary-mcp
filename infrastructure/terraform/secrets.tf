resource "aws_secretsmanager_secret" "db_password" {
  name        = "axion-planetary/db-password"
  description = "RDS database password"

  tags = {
    Migration = "from-gcp-secret-manager"
  }
}

resource "aws_secretsmanager_secret" "api_keys" {
  name        = "axion-planetary/api-keys"
  description = "API keys and tokens"

  tags = {
    Migration = "from-gcp-secret-manager"
  }
}

resource "aws_iam_role_policy" "secrets_access" {
  name = "axion-planetary-secrets-access"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.db_password.arn,
          aws_secretsmanager_secret.api_keys.arn
        ]
      }
    ]
  })
}
