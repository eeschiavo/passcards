SRC_ROOT=$(dir $(abspath $(lastword $(MAKEFILE_LIST))))
NODE_MODULE_DIR=$(SRC_ROOT)/node_modules
NODE_BIN_DIR=$(NODE_MODULE_DIR)/.bin
PKG_DIR=$(SRC_ROOT)/pkg

BROWSERIFY=$(NODE_BIN_DIR)/browserify
FOREACH_FILE=tr ' ' '\n' | xargs -n 1
NODE=node
ROOT_DIR=$(dir $(abspath package.json))
SILENCE_CMD=1>/dev/null 2>/dev/null
SILENCE_STDOUT=1>/dev/null
TMP_DIR_CMD=mktemp -d /tmp/onepass.XXXXX
TSC=$(NODE_BIN_DIR)/tsc
TSD=$(NODE_BIN_DIR)/tsd
TSLINT=$(NODE_BIN_DIR)/tslint

