using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;

// Read-only process metadata. No WMI service, injection, or memory writes.
class ProcessScanner {
 public class Info { public int pid; public string name; public string path; public string cmd; public string start; public string packageFamily; public string version; }
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern int GetPackageFamilyName(IntPtr handle,ref uint length,StringBuilder family);
 static string PackageFamily(IntPtr handle) {
  uint length=0;
  if(GetPackageFamilyName(handle,ref length,null)!=122||length==0||length>4096)return "";
  var family=new StringBuilder((int)length);
  return GetPackageFamilyName(handle,ref length,family)==0?family.ToString():"";
 }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool QueryFullProcessImageName(IntPtr handle,int flags,StringBuilder text,ref int length);
 [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr handle,int info,IntPtr buffer,int length,out int needed);
 [StructLayout(LayoutKind.Sequential)] struct UnicodeString { public ushort Length; public ushort MaximumLength; public IntPtr Buffer; }
 static string CommandLine(IntPtr handle) {
  int needed;NtQueryInformationProcess(handle,60,IntPtr.Zero,0,out needed);
  if(needed<=0||needed>1048576)throw new InvalidOperationException();
  IntPtr buffer=Marshal.AllocHGlobal(needed);
  try {
   if(NtQueryInformationProcess(handle,60,buffer,needed,out needed)!=0)throw new InvalidOperationException();
   UnicodeString text=(UnicodeString)Marshal.PtrToStructure(buffer,typeof(UnicodeString));
   long offset=text.Buffer.ToInt64()-buffer.ToInt64();
   if(offset<0||offset+text.Length>needed)throw new InvalidOperationException();
   return Marshal.PtrToStringUni(text.Buffer,text.Length/2);
  } finally{Marshal.FreeHGlobal(buffer);}
 }
 public static List<Info> Scan(out int inaccessible){
  var result=new List<Info>();inaccessible=0;int session=Process.GetCurrentProcess().SessionId;
  foreach(Process p in Process.GetProcesses())using(p)try{
   if(p.SessionId!=session)continue;
   string name=p.ProcessName;
   bool java=name.Equals("java",StringComparison.OrdinalIgnoreCase)||name.Equals("javaw",StringComparison.OrdinalIgnoreCase);
   if(!java&&!name.Equals("Minecraft",StringComparison.OrdinalIgnoreCase)&&!name.Equals("Minecraft.Windows",StringComparison.OrdinalIgnoreCase)&&!name.Equals("MinecraftPreview",StringComparison.OrdinalIgnoreCase)&&!name.Equals("Minecraft.WindowsBeta",StringComparison.OrdinalIgnoreCase))continue;
   IntPtr handle=OpenProcess(0x1000,false,p.Id);if(handle==IntPtr.Zero){inaccessible++;continue;}
   try{var text=new StringBuilder(32768);int size=text.Capacity;string executable=QueryFullProcessImageName(handle,0,text,ref size)?text.ToString():"";
    string cmd=java?CommandLine(handle):"";
    string version="";if(!java&&executable.Length>0)try{version=FileVersionInfo.GetVersionInfo(executable).FileVersion;}catch{}
    result.Add(new Info{pid=p.Id,name=name,path=executable,cmd=cmd,start=p.StartTime.ToUniversalTime().ToString("o"),packageFamily=java?"":PackageFamily(handle),version=version});
   }finally{CloseHandle(handle);}
  }catch(InvalidOperationException){}catch(System.ComponentModel.Win32Exception){inaccessible++;}
  return result;
 }
 static int Main(){
  Console.OutputEncoding=new UTF8Encoding(false); int inaccessible;
  var result=Scan(out inaccessible);
  Console.Write(new JavaScriptSerializer().Serialize(new{processes=result,inaccessible=inaccessible}));return 0;
 }
}
