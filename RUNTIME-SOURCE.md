# Bundled Java runtime

This Windows preview bundles a reduced Eclipse Temurin OpenJDK 17.0.20.1+1 runtime, produced with jlink from the unmodified vendor binary distribution. Modules: java.base, jdk.attach and jdk.internal.jvmstat.

- Binary distribution: https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.20.1%2B1/OpenJDK17U-jdk_x64_windows_hotspot_17.0.20.1_1.zip
- Verified binary SHA-256: e53a79c3c3d86865bd7e787903884331068e71321714ffd44f145785affc7cb0
- Corresponding source: https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.20.1%2B1/OpenJDK17U-jdk-sources_17.0.20.1_1.tar.gz
- Vendor release: https://github.com/adoptium/temurin17-binaries/releases/tag/jdk-17.0.20.1%2B1

The runtime is licensed under GPLv2 with the Classpath Exception, with component notices in runtime/legal and runtime/NOTICE. These files accompany the runtime in the installer. The application source has its own MIT license. Electron's distribution also includes its license and third-party notices.

Recreate the runtime with JAVA_HOME pointing to that JDK and run node scripts/build-runtime.js. No modifications to the Java source are made.
