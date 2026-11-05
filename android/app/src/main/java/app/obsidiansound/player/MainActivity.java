package app.obsidiansound.player;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import app.obsidiansound.player.library.LawlietLibraryPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LawlietLibraryPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
