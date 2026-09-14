package presence;

import java.io.*;
import java.lang.instrument.Instrumentation;
import java.lang.management.ManagementFactory;
import java.lang.reflect.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.Properties;
import java.util.concurrent.*;

/** Read-only sensor. Does not transform classes or read server/world names. */
public final class Agent {
    private static volatile String config;
    private static ScheduledExecutorService timer;
    private static volatile Instrumentation instrumentation;
    public static void premain(String options, Instrumentation inst) { start(options, inst); }
    public static void agentmain(String options, Instrumentation inst) { start(options, inst); }
    private static synchronized void start(String options, Instrumentation inst) {
        config = options; instrumentation = inst;
        if (timer != null) return;
        timer = Executors.newSingleThreadScheduledExecutor(r -> { Thread t = new Thread(r, "Minecraft private presence"); t.setDaemon(true); return t; });
        timer.scheduleWithFixedDelay(() -> { try { send(readMode()); } catch (Exception ignored) { } }, 1, 2, TimeUnit.SECONDS);
    }
    static String readMode() {
        for (Class<?> type : instrumentation.getAllLoadedClasses()) {
            String name = type.getName();
            if (!name.equals("net.minecraft.client.Minecraft") && !name.equals("net.minecraft.client.MinecraftClient") && !name.equals("net.minecraft.class_310")) continue;
            try { return modeOf(type); } catch (ReflectiveOperationException | RuntimeException ignored) { return "unknown"; }
        }
        return "unknown";
    }
    public static String modeOf(Class<?> type) throws ReflectiveOperationException {
        Method getter = method(type, "getInstance", "method_1551", "getMinecraft", "func_71410_x");
        Object client = getter.invoke(null);
        if (client == null) return "unknown";
        Field world = field(type, "level", "world", "field_1687", "theWorld", "field_71441_e");
        if (world.get(client) == null) return "menu";
        Method single = method(type, "hasSingleplayerServer", "isInSingleplayer", "method_1542", "isSingleplayer", "func_71356_B");
        Object result = single.invoke(client);
        return Boolean.TRUE.equals(result) ? "singleplayer" : Boolean.FALSE.equals(result) ? "multiplayer" : "unknown";
    }
    private static Method method(Class<?> type, String... names) throws NoSuchMethodException {
        for (String name : names) try { Method m = type.getDeclaredMethod(name); m.setAccessible(true); return m; } catch (NoSuchMethodException ignored) { }
        throw new NoSuchMethodException("Unsupported mapping");
    }
    private static Field field(Class<?> type, String... names) throws NoSuchFieldException {
        for (String name : names) try { Field f = type.getDeclaredField(name); f.setAccessible(true); return f; } catch (NoSuchFieldException ignored) { }
        throw new NoSuchFieldException("Unsupported mapping");
    }
    private static void send(String mode) throws Exception {
        if (config == null) return;
        Properties p = new Properties(); try (InputStream in = new FileInputStream(config)) { p.load(in); }
        URL url = new URL(p.getProperty("url") + "/api/telemetry");
        // The sensor can only talk to IPv4 loopback, even if the config is edited.
        if (!url.getProtocol().equals("http") || !url.getHost().equals("127.0.0.1") || url.getUserInfo() != null) return;
        String pid = ManagementFactory.getRuntimeMXBean().getName().split("@")[0];
        if (!pid.matches("[0-9]+")) return;
        byte[] payload = ("{\"pid\":" + pid + ",\"mode\":\"" + mode + "\"}").getBytes(StandardCharsets.UTF_8);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setConnectTimeout(1500); conn.setReadTimeout(1500); conn.setRequestMethod("POST"); conn.setDoOutput(true);
        conn.setRequestProperty("Authorization", "Bearer " + p.getProperty("token")); conn.setRequestProperty("Content-Type", "application/json");
        try { try (OutputStream out = conn.getOutputStream()) { out.write(payload); } conn.getResponseCode(); } finally { conn.disconnect(); }
    }
}
