package presence;
import com.sun.tools.attach.VirtualMachine;
public final class Attach {
    public static void main(String[] args) throws Exception {
        if (args.length != 3 || !args[0].matches("[0-9]+")) throw new IllegalArgumentException("PID, sensor JAR and local configuration required");
        VirtualMachine vm = VirtualMachine.attach(args[0]);
        try { vm.loadAgent(args[1], args[2]); } finally { vm.detach(); }
    }
}
