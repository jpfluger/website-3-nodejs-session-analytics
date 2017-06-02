#!/bin/bash

# install.sh
# handles installation of 
# 1. npm modules
# 2. bower
# 3. bower file/folder copying to public/_third folder

BOWERDIR=`pwd`/bower_components
PUBLICDIR_THIRDPARTY=`pwd`/public/_third

function installNodeModules {

	# install local npm modules
	npm install

	# install bower globally
	npm install -g bower
}

function bowerInstall {

    # bower_components must exist and have content before proceeding
    # see README.md for details
    bower install --allow-root
    #if [ ! -d "bower_components" ]; then
    #    echo "Install bower_components before proceeding. See README.md for instructions."
    #    exit 1
    #fi

    if [ -d "${PUBLICDIR_THIRDPARTY}" ]; then
        rm -R ${PUBLICDIR_THIRDPARTY}
    fi

    mkdir -p ${PUBLICDIR_THIRDPARTY}

    # jquery (not defined in bower.json b/c bootstrap already requires it)
    mkdir -p ${PUBLICDIR_THIRDPARTY}/jquery/dist
    cp ${BOWERDIR}/jquery/dist/jquery.min.js ${PUBLICDIR_THIRDPARTY}/jquery/dist/jquery.min.js

    # bootstrap
    mkdir -p ${PUBLICDIR_THIRDPARTY}/bootstrap
    cp -R ${BOWERDIR}/bootstrap/dist ${PUBLICDIR_THIRDPARTY}/bootstrap/

    # bootstrap dialog
    mkdir -p ${PUBLICDIR_THIRDPARTY}/bootstrap-dialog
    cp -R ${BOWERDIR}/bootstrap-dialog/dist ${PUBLICDIR_THIRDPARTY}/bootstrap-dialog/

    # lodash
    mkdir -p ${PUBLICDIR_THIRDPARTY}/lodash/dist
    cp ${BOWERDIR}/lodash/dist/lodash.min.js ${PUBLICDIR_THIRDPARTY}/lodash/dist/lodash.min.js

    # moment
    mkdir -p ${PUBLICDIR_THIRDPARTY}/moment/min
    cp ${BOWERDIR}/moment/min/moment.min.js ${PUBLICDIR_THIRDPARTY}/moment/min/moment.min.js

    # numeral
    mkdir -p ${PUBLICDIR_THIRDPARTY}/numeraljs/min
    cp ${BOWERDIR}/numeraljs/min/numeral.min.js ${PUBLICDIR_THIRDPARTY}/numeraljs/min/numeral.min.js

    echo "bower folders created:"
    ls ${PUBLICDIR_THIRDPARTY}/
}

function updateMaxMind {
    ./updateMaxMind.sh
}

installNodeModules
bowerInstall
updateMaxMind

echo "finished install.sh"