# Parallel Git Clone/Delete Stress Test Script
# Runs multiple batches simultaneously to clone and delete the repository 10,000 times

$repoUrl = "https://github.com/Dhenenjay/axion-planetary-mcp.git"
$totalIterations = 10000
$parallelJobs = 10  # Number of parallel batch jobs
$baseDir = "D:\git-stress-test-parallel"
$logFile = "$baseDir\git-parallel-stress-test-log.txt"

# Create base directory
if (-Not (Test-Path $baseDir)) {
    New-Item -ItemType Directory -Path $baseDir -Force | Out-Null
}

# Initialize log
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"=== Parallel Git Clone/Delete Stress Test Started at $timestamp ===" | Out-File -FilePath $logFile
"Repository: $repoUrl" | Out-File -FilePath $logFile -Append
"Total cycles: $totalIterations" | Out-File -FilePath $logFile -Append
"Parallel jobs: $parallelJobs" | Out-File -FilePath $logFile -Append
"" | Out-File -FilePath $logFile -Append

Write-Host "Starting Parallel Git clone/delete stress test" -ForegroundColor Cyan
Write-Host "Repository: $repoUrl" -ForegroundColor Cyan
Write-Host "Total cycles: $totalIterations" -ForegroundColor Cyan
Write-Host "Parallel jobs: $parallelJobs" -ForegroundColor Yellow
Write-Host ""

$startTime = Get-Date

# ScriptBlock for each parallel job
$scriptBlock = {
    param($repoUrl, $baseDir, $startIndex, $endIndex, $jobId)
    
    $results = @{
        JobId = $jobId
        Success = 0
        CloneFail = 0
        DeleteFail = 0
        Errors = @()
    }
    
    for ($i = $startIndex; $i -le $endIndex; $i++) {
        $cloneDir = "$baseDir\repo-$i"
        $cycleSuccess = $true
        
        try {
            # CLONE
            $null = git clone --quiet --depth 1 $repoUrl $cloneDir 2>&1
            
            if ($LASTEXITCODE -ne 0) {
                $results.CloneFail++
                $cycleSuccess = $false
                $results.Errors += "Cycle $i - Clone failed"
            }
            
            # DELETE
            if (Test-Path $cloneDir) {
                try {
                    Remove-Item -Path $cloneDir -Recurse -Force -ErrorAction Stop
                    
                    if (Test-Path $cloneDir) {
                        $results.DeleteFail++
                        $cycleSuccess = $false
                        $results.Errors += "Cycle $i - Delete failed (still exists)"
                    }
                } catch {
                    $results.DeleteFail++
                    $cycleSuccess = $false
                    $results.Errors += "Cycle $i - Delete error: $($_.Exception.Message)"
                }
            } elseif ($cycleSuccess) {
                $results.DeleteFail++
                $cycleSuccess = $false
            }
            
            if ($cycleSuccess) {
                $results.Success++
            }
            
        } catch {
            $results.Errors += "Cycle $i - Exception: $($_.Exception.Message)"
            
            # Cleanup attempt
            if (Test-Path $cloneDir) {
                try {
                    Remove-Item -Path $cloneDir -Recurse -Force -ErrorAction SilentlyContinue
                } catch {}
            }
        }
    }
    
    return $results
}

# Calculate iterations per job
$iterationsPerJob = [math]::Floor($totalIterations / $parallelJobs)
$jobs = @()

# Start parallel jobs
Write-Host "Starting $parallelJobs parallel jobs..." -ForegroundColor Cyan
for ($j = 1; $j -le $parallelJobs; $j++) {
    $startIndex = (($j - 1) * $iterationsPerJob) + 1
    $endIndex = if ($j -eq $parallelJobs) { $totalIterations } else { $j * $iterationsPerJob }
    
    Write-Host "  Job $j : Processing cycles $startIndex to $endIndex" -ForegroundColor Yellow
    
    $job = Start-Job -ScriptBlock $scriptBlock -ArgumentList $repoUrl, $baseDir, $startIndex, $endIndex, $j
    $jobs += $job
}

Write-Host ""
Write-Host "All jobs started. Waiting for completion..." -ForegroundColor Cyan
Write-Host ""

# Monitor jobs
$completedJobs = 0
$lastUpdate = Get-Date

while ($completedJobs -lt $parallelJobs) {
    Start-Sleep -Seconds 5
    
    $currentCompleted = ($jobs | Where-Object { $_.State -eq 'Completed' }).Count
    
    if ($currentCompleted -gt $completedJobs) {
        $completedJobs = $currentCompleted
        $elapsed = (Get-Date) - $startTime
        Write-Host "Progress: $completedJobs/$parallelJobs jobs completed | Elapsed: $($elapsed.ToString('hh\:mm\:ss'))" -ForegroundColor Green
    }
    
    # Update every 30 seconds even if no change
    if (((Get-Date) - $lastUpdate).TotalSeconds -ge 30) {
        $elapsed = (Get-Date) - $startTime
        $runningJobs = ($jobs | Where-Object { $_.State -eq 'Running' }).Count
        Write-Host "Status: $runningJobs jobs running, $completedJobs jobs completed | Elapsed: $($elapsed.ToString('hh\:mm\:ss'))" -ForegroundColor Cyan
        $lastUpdate = Get-Date
    }
}

Write-Host ""
Write-Host "All jobs completed. Collecting results..." -ForegroundColor Green

# Collect results
$totalSuccess = 0
$totalCloneFail = 0
$totalDeleteFail = 0
$allErrors = @()

foreach ($job in $jobs) {
    $result = Receive-Job -Job $job
    
    if ($result) {
        $totalSuccess += $result.Success
        $totalCloneFail += $result.CloneFail
        $totalDeleteFail += $result.DeleteFail
        $allErrors += $result.Errors
        
        # Log job results
        "Job $($result.JobId) - Success: $($result.Success), Clone Fail: $($result.CloneFail), Delete Fail: $($result.DeleteFail)" | Out-File -FilePath $logFile -Append
    }
    
    Remove-Job -Job $job
}

# Clean up base directory
Write-Host "Cleaning up leftover files..." -ForegroundColor Yellow
Get-ChildItem -Path $baseDir -Directory | Where-Object { $_.Name -like "repo-*" } | ForEach-Object {
    try {
        Remove-Item -Path $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    } catch {}
}

# Final summary
$endTime = Get-Date
$totalTime = $endTime - $startTime
$totalFailures = $totalCloneFail + $totalDeleteFail
$successRate = [math]::Round(($totalSuccess / $totalIterations) * 100, 2)

Write-Host ""
Write-Host "=== Stress Test Complete ===" -ForegroundColor Green
Write-Host "Total cycles attempted: $totalIterations" -ForegroundColor Cyan
Write-Host "Successful cycles: $totalSuccess ($successRate%)" -ForegroundColor Green
Write-Host "Failed cycles: $($totalIterations - $totalSuccess)" -ForegroundColor Red
Write-Host "  - Clone failures: $totalCloneFail" -ForegroundColor Red
Write-Host "  - Delete failures: $totalDeleteFail" -ForegroundColor Red
Write-Host "Total time: $($totalTime.ToString('hh\:mm\:ss'))" -ForegroundColor Cyan
Write-Host "Average time per cycle: $([math]::Round($totalTime.TotalSeconds / $totalIterations, 2)) seconds" -ForegroundColor Cyan
Write-Host "Total clones: $totalSuccess" -ForegroundColor Yellow
Write-Host ""
Write-Host "Log file: $logFile" -ForegroundColor Yellow

# Write final summary to log
"" | Out-File -FilePath $logFile -Append
"=== Final Summary ===" | Out-File -FilePath $logFile -Append
"Total cycles attempted: $totalIterations" | Out-File -FilePath $logFile -Append
"Successful cycles: $totalSuccess ($successRate%)" | Out-File -FilePath $logFile -Append
"Failed cycles: $($totalIterations - $totalSuccess)" | Out-File -FilePath $logFile -Append
"Clone failures: $totalCloneFail" | Out-File -FilePath $logFile -Append
"Delete failures: $totalDeleteFail" | Out-File -FilePath $logFile -Append
"Total time: $($totalTime.ToString('hh\:mm\:ss'))" | Out-File -FilePath $logFile -Append
"Average time per cycle: $([math]::Round($totalTime.TotalSeconds / $totalIterations, 2)) seconds" | Out-File -FilePath $logFile -Append
"Parallel jobs used: $parallelJobs" | Out-File -FilePath $logFile -Append
$endTimestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"Completed at: $endTimestamp" | Out-File -FilePath $logFile -Append

# Write first 50 errors if any
if ($allErrors.Count -gt 0) {
    "" | Out-File -FilePath $logFile -Append
    "=== Sample Errors (first 50) ===" | Out-File -FilePath $logFile -Append
    $allErrors | Select-Object -First 50 | ForEach-Object {
        $_ | Out-File -FilePath $logFile -Append
    }
}
