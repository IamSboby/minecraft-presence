using System;
using System.IO;
using System.Diagnostics;
using System.Threading;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using System.Drawing;

// Steam owns this short-lived process; it must never become the persistent hub.
internal class SteamSession {
 internal sealed class Lifetime {
  public bool Played; public long LastGame; public long LastHealthy;
  public bool Continue(long now, int games, bool healthy) {
   // Store activation can finish before the launcher/game appears. Before the
   // first game, use a bounded waiting period rather than guessing launcher life.
   if (!Played && games == 0) { if (healthy) LastHealthy = now; return now < 600000; }
   if (!healthy) return now - LastHealthy < 15000;
   LastHealthy = now;
   if (games > 0) { Played = true; LastGame = now; return true; }
   if (Played) return now - LastGame < 4000;
   return now < 600000;
  }
 }
 public class LaunchConfig { public string executable; public string directory; public string arguments; }
 internal static bool IsGame(ProcessScanner.Info p) {
  string name = (p.name ?? "").ToLowerInvariant(), command = p.cmd ?? "";
  if (name == "minecraft.windows" || (name == "minecraft" && Regex.IsMatch(p.path ?? "", "minecraftuwp|minecraft for windows", RegexOptions.IgnoreCase))) return true;
  if (name != "java" && name != "javaw") return false;
  if (Regex.IsMatch(command, @"net\.minecraft\.server\.|--launchTarget[=\s]+\S*server", RegexOptions.IgnoreCase)) return false;
  return Regex.IsMatch(command, @"net\.minecraft\.client\.|net\.(fabricmc|quiltmc)\.[^\s]*KnotClient|cpw\.mods\.(modlauncher\.Launcher|bootstraplauncher\.BootstrapLauncher)|net\.minecraft\.launchwrapper\.Launch|org\.(multimc|prismlauncher)\.EntryPoint", RegexOptions.IgnoreCase);
 }
 static int SelfTest() {
  var life = new Lifetime();
  if (!life.Continue(0, 0, true) || !life.Continue(34000, 0, true) || !life.Continue(79000, 1, true) || life.Continue(83000, 0, true)) return 1;
  life = new Lifetime();
  if (!life.Continue(30000, 0, false) || !life.Continue(599999, 0, true) || life.Continue(600000, 0, true)) return 2;
  life = new Lifetime();
  if (!life.Continue(1000, 2, true) || !life.Continue(5000, 1, true) || !life.Continue(8999, 0, true) || life.Continue(9000, 0, true)) return 3;
  life = new Lifetime();
  if (!life.Continue(0, 1, true) || life.Continue(15000, 0, false)) return 4;
  if (!IsGame(new ProcessScanner.Info { name="javaw", cmd="net.fabricmc.loader.impl.launch.knot.KnotClient --gameDir D:\\external" })) return 5;
  if (IsGame(new ProcessScanner.Info { name="java", cmd="net.minecraft.server.Main" })) return 6;
  if (!IsGame(new ProcessScanner.Info { name="Minecraft.Windows" }) || IsGame(new ProcessScanner.Info { name="Minecraft", path="C:\\XboxGames\\Minecraft Launcher\\Content\\Minecraft.exe" })) return 7;
  return 0;
 }
 [STAThread] static int Main(string[] args) {
  if (args.Length == 1 && args[0] == "--self-test") return SelfTest();
  bool created;
  using (var mutex = new Mutex(true, "Local\\MinecraftPresenceSteamSession", out created)) {
   if (!created) return 0;
   try {
    if (args.Length != 1 || !Path.IsPathRooted(args[0])) throw new InvalidOperationException();
    var config = new JavaScriptSerializer().Deserialize<LaunchConfig>(File.ReadAllText(args[0]));
    if (config == null || !Path.IsPathRooted(config.executable) || !File.Exists(config.executable) || !Directory.Exists(config.directory)) throw new InvalidOperationException();
    Application.EnableVisualStyles();
    bool stop = false;
    using (var tray = new NotifyIcon()) {
     tray.Icon = SystemIcons.Application; tray.Text = "Minecraft Steam session: waiting for game";
     var menu = new ContextMenuStrip(); menu.Items.Add("End Steam session", null, delegate { stop = true; }); tray.ContextMenuStrip = menu; tray.Visible = true;
     Process.Start(new ProcessStartInfo(config.executable, config.arguments ?? "") { WorkingDirectory = config.directory, UseShellExecute = true });
     var clock = Stopwatch.StartNew(); var life = new Lifetime(); long nextScan = 0;
     while (!stop) {
      Application.DoEvents(); long now = clock.ElapsedMilliseconds;
      if (now >= nextScan) {
       int count = 0, inaccessible; bool healthy = true;
       try { foreach (var p in ProcessScanner.Scan(out inaccessible)) if (IsGame(p)) count++; if (count == 0 && inaccessible > 0) healthy = false; }
       catch { healthy = false; }
       if (!life.Continue(now, count, healthy)) break;
       tray.Text = life.Played ? "Minecraft Steam session: game running" : "Minecraft Steam session: waiting for game";
       nextScan = now + 1000;
      }
      Thread.Sleep(100);
     }
     tray.Visible = false; menu.Dispose();
    }
    return 0;
   } catch {
    MessageBox.Show("Could not launch Minecraft. Open Minecraft Presence and add the Steam shortcut again.", "Minecraft Steam session", MessageBoxButtons.OK, MessageBoxIcon.Error); return 1;
   }
  }
 }
}
