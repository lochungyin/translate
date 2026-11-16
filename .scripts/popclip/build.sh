set -e

rm -f SuiTranslate.popclipextz
mkdir SuiTranslate.popclipext
cp Config.plist Pot.png Pot.sh SuiTranslate.popclipext
zip -r SuiTranslate.popclipextz SuiTranslate.popclipext
rm -r SuiTranslate.popclipext
