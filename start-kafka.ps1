$maxTries = 24
$tried = 0
Write-Host 'Waiting for Docker Desktop to be ready (up to 2 min)...'
while ($tried -lt $maxTries) {
    Start-Sleep 5
    $tried = $tried + 1
    $output = docker ps 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host 'Docker daemon is ready! Starting Kafka containers...'
        docker compose up -d kafka kafka-ui
        Write-Host 'Kafka broker is running on localhost:9092'
        Write-Host 'Kafka UI dashboard at http://localhost:8080'
        exit 0
    }
    Write-Host ('Waiting... ' + ($tried * 5) + 's elapsed')
}
Write-Host 'TIMEOUT: Docker Desktop did not start within 2 minutes.'
Write-Host 'Please open Docker Desktop manually, then run: npm run kafka:start'
