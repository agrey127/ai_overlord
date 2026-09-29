# Local Windows speech recognition. Audio is used only for command detection here.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$source = @'
using System;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Speech.Recognition;
using System.Speech.Synthesis;
using System.Threading;

public static class BaselineWakeBridge {
    [DllImport("user32.dll")]
    private static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra);

    private const uint KeyUp = 0x0002;
    private static SpeechRecognitionEngine recognizer;
    private static readonly object outputLock = new object();

    private static void Emit(string type, string message = null) {
        lock (outputLock) {
            if (message == null) Console.WriteLine("{\"type\":\"" + type + "\"}");
            else Console.WriteLine("{\"type\":\"" + type + "\",\"message\":\"" + message.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"}");
            Console.Out.Flush();
        }
    }

    private static void ToggleWispr() {
        // Wispr Flow's default Windows hands-free shortcut: Ctrl + Win + Space.
        keybd_event(0x11, 0, 0, UIntPtr.Zero);
        keybd_event(0x5B, 0, 0, UIntPtr.Zero);
        keybd_event(0x20, 0, 0, UIntPtr.Zero);
        Thread.Sleep(70);
        keybd_event(0x20, 0, KeyUp, UIntPtr.Zero);
        keybd_event(0x5B, 0, KeyUp, UIntPtr.Zero);
        keybd_event(0x11, 0, KeyUp, UIntPtr.Zero);
    }

    private static void CancelWispr() {
        keybd_event(0x1B, 0, 0, UIntPtr.Zero);
        keybd_event(0x1B, 0, KeyUp, UIntPtr.Zero);
    }

    private static void SayReady() {
        using (SpeechSynthesizer speaker = new SpeechSynthesizer()) {
            speaker.SetOutputToDefaultAudioDevice();
            speaker.Speak("Ready.");
        }
    }

    public static void Run() {
        try {
            recognizer = new SpeechRecognitionEngine(new CultureInfo("en-US"));
            Choices phrases = new Choices(new string[] { "hello baseline", "send it", "cancel baseline" });
            GrammarBuilder grammar = new GrammarBuilder(phrases);
            grammar.Culture = new CultureInfo("en-US");
            recognizer.LoadGrammar(new Grammar(grammar));
            recognizer.SpeechRecognized += delegate(object sender, SpeechRecognizedEventArgs args) {
                if (args.Result.Confidence < 0.68f) return;
                string phrase = args.Result.Text.ToLowerInvariant();
                if (phrase == "hello baseline") Emit("wake");
                else if (phrase == "send it") Emit("send");
                else if (phrase == "cancel baseline") Emit("cancel");
            };
            recognizer.SetInputToDefaultAudioDevice();
            recognizer.RecognizeAsync(RecognizeMode.Multiple);
            Emit("ready");
            string command;
            while ((command = Console.ReadLine()) != null) {
                command = command.Trim().ToUpperInvariant();
                if (command == "QUIT") break;
                if (command == "ACK_AND_TOGGLE") {
                    try { SayReady(); } catch (Exception error) { Console.Error.WriteLine("Voice acknowledgement failed: " + error.Message); }
                    ToggleWispr();
                }
                if (command == "TOGGLE") ToggleWispr();
                if (command == "CANCEL") CancelWispr();
            }
        } catch (Exception error) {
            Emit("error", error.GetType().Name + ": " + error.Message);
        } finally {
            if (recognizer != null) {
                try { recognizer.RecognizeAsyncCancel(); } catch { }
                recognizer.Dispose();
            }
        }
    }
}
'@
Add-Type -TypeDefinition $source -ReferencedAssemblies @('System.Speech', 'System')
[BaselineWakeBridge]::Run()
