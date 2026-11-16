url="http://127.0.0.1:60829/translate"

if curl -s --data-raw "$POPCLIP_TEXT" "$url"; then
    exit 0
fi

open -g -b com.lochungyin.sui.translate || exit 1
sleep 2
curl -s --data-raw "$POPCLIP_TEXT" "$url"
