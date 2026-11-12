@Library('shared-library') _

node {
    stage('Checkout') {
        checkout scm
    }
    // The repository root also contains the V1 app. Build only ship 2.0.
    // The company shared library must preserve this working directory.
    dir('phase2-demo') {
        if (!fileExists('package-lock.json')) {
            error('Ship 2.0 package-lock.json is missing; check the checkout directory.')
        }
        nodejs.npm()
    }
}
