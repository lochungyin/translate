param(
[string]$PLAIN_TEXT
)

$encode_text = [System.Text.Encoding]::UTF8.GetBytes($PLAIN_TEXT)

Invoke-WebRequest http://127.0.0.1:60829/translate -Method POST -Body $encode_text -UseBasicParsing
