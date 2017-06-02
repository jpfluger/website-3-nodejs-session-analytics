#!/bin/bash

MMDIR=`pwd`/maxmind
MMURL=http://geolite.maxmind.com/download/geoip/database/GeoLite2-City.tar.gz
MMNAME=GeoLite2-City.mmdb
MMPATH=$MMDIR/$MMNAME
MMTMPPATH=$MMDIR/tmp/GeoLite2-City_*/*.mmdb

function removeMMTMP  {
	if [ -d "${MMDIR}/tmp" ]; then
	    rm -Rf ${MMDIR}/tmp
	fi
}

removeMMTMP

mkdir -p ${MMDIR}/tmp

#if [ -f "${MMDIR/geo}"]
cd ${MMDIR}/tmp
wget ${MMURL}
echo "new maxmind db downloaded"

tar -vxzf GeoLite2-City.tar.gz
NEWDIRNAME=`ls -d */`
echo "extracting maxmind db to maxmind/tmp/${NEWDIRNAME}"

cd ../../

if [ -f "${MMPATH}" ]; then
	echo "replacing existing maxmind db with new db"
else
	echo "installing new maxmind db"
fi

mv ${MMTMPPATH} ${MMPATH}

removeMMTMP

echo "maxmind updated"