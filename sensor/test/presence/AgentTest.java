package presence;
public final class AgentTest {
    public static final class FakeClient {
        static final FakeClient INSTANCE = new FakeClient();
        public Object level; public boolean local;
        public static FakeClient getInstance() { return INSTANCE; }
        public boolean hasSingleplayerServer() { return local; }
    }
    public static void main(String[] args) throws Exception {
        check("menu"); FakeClient.INSTANCE.level = new Object(); FakeClient.INSTANCE.local = true; check("singleplayer");
        FakeClient.INSTANCE.local = false; check("multiplayer"); FakeClient.INSTANCE.level = null; check("menu");
        System.out.println("Sensor: menu -> solo -> multiplayer -> menu passed");
    }
    static void check(String expected) throws Exception { if (!expected.equals(Agent.modeOf(FakeClient.class))) throw new AssertionError(expected); }
}
