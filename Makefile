.PHONY: setup dev run

setup:
	docker build . -t morethan-log ; \
	docker run -it --rm -v $(PWD):/app morethan-log /bin/bash -c "yarn install"

dev:
	docker run -it --rm -v $(PWD):/app -p 8001:3000 morethan-log /bin/bash -c "yarn run dev"

run:
	docker run -it --rm -v $(PWD):/app morethan-log /bin/bash

