#!/bin/sh

cd www || {
    printf "Could not cd to root dir (./www)"
    exit 1
}

php -S localhost:8081
