pipeline {
    environment {
    	NODE_MAC_PATH="/usr/local/opt/node@16/bin/"
    	PATH="${env.NODE_MAC_PATH}:${env.PATH}"
    	VERSION = sh(returnStdout: true, script: "${NODE_PATH}/node -p -e \"require('./package.json').version\" | tr -d \"\n\"")
    }

    agent {
    	label 'mac'
    }

	parameters {
		choice(name: 'LANE', choices: ['adhoc', 'adhoctest', 'release'], description: '')
	}

	stages {
		stage("Build IOS app") {
		    agent {
            	label 'mac'
            }
			steps {
				script {
					createAppfile()
					def stage = (${params.LANE} == 'adhoctest') ? 'test' : 'prod'
					sh "npm ci"
					sh "node dist ${stage}"
					sh "node buildSrc/prepareMobileBuild.js dist"
					dir('app-ios') {
						sh "fastlane ios ${params.LANE}"
					}
					if (${params.LANE == 'release'}) {
						def tag = "tutanota-ios-release-${VERSION}"
						sh "git tag ${tag}"
						sh "git push --tags"
					}
				}
			}
		}
	}
}

def createAppfile() {
	script {
		def app_identifier = 'de.tutao.tutanota'
		def appfile = './app-ios/fastlane/Appfile'

		sh "echo \"app_identifier('${app_identifier}')\" > ${appfile}"

		withCredentials([string(credentialsId: 'apple-id', variable: 'apple_id']) {
			sh "echo \"apple_id('${apple_id}')\" >> ${appfile}"
		}
		withCredentials([string(credentialsId: 'itc-team-id', variable: 'itc_team_id']) {
			sh "echo \"itc_team_id('${itc_team_id}')\" >> ${appfile}"
		}
		withCredentials([string(credentialsId: 'team-id', variable: 'team_id']) {
			sh "echo \"team_id('${team_id}')\" >> ${appfile}"
		}
	}
}