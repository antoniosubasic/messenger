#!/usr/bin/env bash

inputPath="$1"
source $inputPath/scripts/docker-convert-util.sh
ASCIIDOCTOR_VERSION="1.58"

echo "input => $inputPath"
echo building html

# Create directories and copy images before conversion
createDirectoriesAndCopyImages "$inputPath"

convertFilesToSlides "$inputPath" $ASCIIDOCTOR_VERSION

convertFilesToHTML "$inputPath" $ASCIIDOCTOR_VERSION

find $inputPath -depth -name "*.adoc" -print
find $inputPath -depth -name "*.adoc" -delete
