resource "aws_db_parameter_group" "main" {
  name   = "axion-planetary-postgres15"
  family = "postgres15"

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  tags = {
    Name      = "axion-planetary-db-params"
    Migration = "from-gcp-cloud-sql"
  }
}

resource "aws_db_subnet_group" "main" {
  name       = "axion-planetary-db-subnet"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "axion-planetary-db-subnet-group"
  }
}
