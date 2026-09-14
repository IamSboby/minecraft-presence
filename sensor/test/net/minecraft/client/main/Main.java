package net.minecraft.client.main;
import java.nio.file.*;import net.minecraft.client.Minecraft;
/** Synthetic process for end-to-end tests, never part of the distributed sensor. */
public final class Main {
 public static void main(String[] args)throws Exception{
  Path control=Paths.get(args[2]);
  while(true){String mode=new String(Files.readAllBytes(control)).trim();if(mode.equals("exit"))return;
   Minecraft game=Minecraft.getInstance();game.local=mode.equals("singleplayer");game.level=mode.equals("menu")?null:new Object();Thread.sleep(100);
  }
 }
}
