package presence.fixture;

import java.nio.file.Path;

/** Emulates a launcher that takes longer than the former 30-second grace period. */
public final class DelayedLauncher {
    public static void main(String[] args) throws Exception {
        Thread.sleep(35000);
        Process game = new ProcessBuilder(
                Path.of(System.getProperty("java.home"), "bin", "java.exe").toString(),
                "-cp", System.getProperty("java.class.path"),
                "net.minecraft.client.main.Main", "--gameDir", args[0], args[1])
                .inheritIO().start();
        System.exit(game.waitFor());
    }
}
