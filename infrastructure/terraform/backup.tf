resource "aws_backup_vault" "main" {
  name = "axion-planetary-backup-vault"

  tags = {
    Environment = var.environment
  }
}

resource "aws_backup_plan" "main" {
  name = "axion-planetary-backup-plan"

  rule {
    rule_name         = "daily_backup"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 2 * * ? *)"

    lifecycle {
      delete_after = 30
    }
  }

  rule {
    rule_name         = "weekly_backup"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 3 ? * 1 *)"

    lifecycle {
      delete_after = 90
    }
  }
}
