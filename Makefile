create-dist:
	npm run build
	mv dist/ martins0n-duckdb-datasource && \
	zip -r martins0n-duckdb-datasource-1.0.0.zip martins0n-duckdb-datasource
	rm -rf martins0n-duckdb-datasource

