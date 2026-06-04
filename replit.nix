{pkgs}: {
  deps = [
    pkgs.mesa
    pkgs.nspr
    pkgs.gdk-pixbuf
    pkgs.expat
    pkgs.cairo
    pkgs.pango
    pkgs.glib
    pkgs.dbus
    pkgs.cups
    pkgs.at-spi2-core
    pkgs.alsa-lib
    pkgs.nss
    pkgs.xorg.libXi
    pkgs.xorg.libXcursor
    pkgs.xorg.libxcb
    pkgs.xorg.libXrandr
    pkgs.xorg.libXfixes
    pkgs.xorg.libXext
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcomposite
    pkgs.xorg.libX11
    pkgs.chromium
  ];
}
