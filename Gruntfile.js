module.exports = function(grunt) {

	// Project configuration.
	grunt.initConfig({
		meta: {
			package: grunt.file.readJSON('package.json'),
			src: {
				main: '**/*.js',
				test: '**/*[sS]pec.js'
			},
			bin: {
				coverage: 'bin/coverage'
			}
		},
		jasmine: {
			coverage: {
				src: '<%= meta.src.main %>',
				options: {
					specs: '<%= meta.src.test %>',
					template: require('grunt-template-jasmine-istanbul'),
					templateOptions: {
						coverage: '<%= meta.bin.coverage %>/coverage.json',
						report: [
							{
								type: 'html',
								options: {
									dir: '<%= meta.bin.coverage %>/html'
								}
							},
							{
								type: 'cobertura',
								options: {
									dir: '<%= meta.bin.coverage %>/cobertura'
								}
							},
							{
								type: 'text-summary'
							}
						]
					}
				}
			}
		},
		pkg: grunt.file.readJSON('package.json'),
		uglify: {
			options: {
				banner: '/*! <%= pkg.name %> - v<%= pkg.version %> <%= grunt.template.today("yyyy-mm-dd") %> */\n',
				sourceMap: true,
				// sourceMapIncludeSources: true,
				sourceMapName: 'schnauzer.js.map',
				report: 'gzip'
			},
			my_target: {
				files: [{
					'Schnauzer.min.js': ['Schnauzer.js']
				}]
			}
		}
	});

	// Load the plugin that provides the "uglify" task.
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-jasmine');

	// Default task(s).
	grunt.registerTask('default', ['uglify']);
	grunt.registerTask('test:coverage', ['jasmine:coverage']);

};