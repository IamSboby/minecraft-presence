package net.minecraft.client;
public final class Minecraft {
    private static final Minecraft INSTANCE=new Minecraft();
    public volatile Object level;
    public volatile boolean local;
    public static Minecraft getInstance(){return INSTANCE;}
    public boolean hasSingleplayerServer(){return local;}
}
