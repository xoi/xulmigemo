copy buildscript\makexpi.sh .\

call xpidl.bat xulrunner-sdk-1.9.2
bash makexpi.sh -n xulmigemo -v 0
rem bash makexpi.sh -n xulmigemo -v 0 -s "1.9.2"

rem call xpidl.bat xulrunner-sdk-central
rem bash makexpi.sh -n xulmigemo -v 0 -s "central"

del makexpi.sh
