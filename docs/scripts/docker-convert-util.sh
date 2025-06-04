#!/usr/bin/env bash

createDirectoriesAndCopyImages() {
  buildPath=$1
  
  # Create necessary directories
  mkdir -p $buildPath/docs/wireframe/images
  mkdir -p $buildPath/docs/pflichtenheft/images
  mkdir -p $buildPath/docs/projektauftrag/images
  mkdir -p $buildPath/slides/images
  
  # Copy images to various document directories
  cp -R $buildPath/docs/images/* $buildPath/docs/wireframe/images/ 2>/dev/null || true
  
  cp -R $buildPath/images/* $buildPath/docs/pflichtenheft/images/ 2>/dev/null || true
  cp -R $buildPath/docs/images/* $buildPath/docs/pflichtenheft/images/ 2>/dev/null || true
  
  cp -R $buildPath/images/* $buildPath/docs/projektauftrag/images/ 2>/dev/null || true
  cp -R $buildPath/docs/images/* $buildPath/docs/projektauftrag/images/ 2>/dev/null || true
  
  cp -R $buildPath/images/* $buildPath/slides/images/ 2>/dev/null || true
  
  echo "Created directories and copied images successfully"
}

convertFilesToSlides() {
  buildPath=$1
  asciidoctorVersion=$2

  echo "=== compiling HTML - slides  ==="
  echo $buildPath

  downloadReveal $buildPath

  docker run --rm \
    -v ${PWD}/$buildPath/slides:/documents \
    asciidoctor/docker-asciidoctor:$asciidoctorVersion /bin/bash -c "asciidoctor-revealjs \
         -r asciidoctor-diagram \
         -a icons=font \
         -a revealjs_theme=league@ \
         -a imagesdir=images@ \
         -a revealjsdir=revealjs \
         -a source-highlighter=rouge@ \
         -a revealjs_slideNumber=c/t@ \
         -a revealjs_transition=slide@ \
         -a revealjs_hash=true@ \
         -a sourcedir=src/main/java@ \
         -b revealjs \
         '**/*.adoc'"

  mv $buildPath/slides/* $buildPath
  rmdir $buildPath/slides
}

downloadReveal() {
  buildPath=$1
  REVEAL_VERSION="5.0.0"
  REVEAL_DIR="$buildPath/slides"
  curl -L https://github.com/hakimel/reveal.js/archive/$REVEAL_VERSION.zip --output revealjs.zip
  unzip revealjs.zip

  mv reveal.js-$REVEAL_VERSION ./$REVEAL_DIR/revealjs
  rm revealjs.zip
}

convertFilesToHTML() {
  buildPath=$1
  asciidoctorVersion=$2

  echo "=== compiling HTML - docs  ==="
  echo $buildPath

  docker run --rm \
    -v ${PWD}/$buildPath/docs:/documents \
    asciidoctor/docker-asciidoctor:$asciidoctorVersion /bin/bash -c "asciidoctor \
      -r asciidoctor-diagram \
      -a icons=font \
      -a experimental=true \
      -a source-highlighter=rouge \
      -a rouge-theme=github \
      -a rouge-linenums-mode=inline \
      -a docinfo=shared \
      -a imagesdir=images \
      -a toc=left \
      -a toclevels=2 \
      -a sectanchors=true \
      -a sectnums=true \
      -a favicon=themes/favicon.png \
      -a sourcedir=src/main/java \
      -b html5 \
      '**/*.adoc'"

  mv $buildPath/docs/pflichtenheft/pflichtenheft.html $buildPath/docs/pflichtenheft/index.html
  mv $buildPath/docs/projektauftrag/projektauftrag.html $buildPath/docs/projektauftrag/index.html
}