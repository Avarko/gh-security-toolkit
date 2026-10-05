#!/bin/sh
# Install scanx: link bin/scanx from this clone into a directory on PATH.
#
#   gh repo clone Avarko/gh-security-toolkit ~/.local/share/scanx
#   ~/.local/share/scanx/install.sh
#
# SCANX_BIN_DIR overrides the link directory (default ~/.local/bin). Running it
# again is safe. Updating is `scanx update`, not a reinstall.

set -eu

home=$(cd -P -- "$(dirname -- "$0")" && pwd)
target="$home/bin/scanx"
bin_dir=${SCANX_BIN_DIR:-$HOME/.local/bin}
link="$bin_dir/scanx"

[ -f "$target" ] || { echo "install.sh: $target not found" >&2; exit 1; }
chmod +x "$target"
mkdir -p "$bin_dir"

if [ -L "$link" ]; then
	current=$(readlink -- "$link")
	if [ "$current" = "$target" ]; then
		echo "scanx is already installed: $link -> $target"
	else
		ln -sf -- "$target" "$link"
		echo "Replaced $link (was -> $current)"
	fi
elif [ -e "$link" ]; then
	echo "install.sh: $link exists and is not a symlink; remove it first" >&2
	exit 1
else
	ln -s -- "$target" "$link"
	echo "Installed $link -> $target"
fi

case ":${PATH}:" in
	*":$bin_dir:"*) ;;
	*)
		echo "⚠️  $bin_dir is not on PATH. Add it, e.g.:" >&2
		# shellcheck disable=SC2016 # printed literally for the user to paste
		echo '   export PATH="$HOME/.local/bin:$PATH"' >&2
		;;
esac

for tool in docker git; do
	command -v "$tool" >/dev/null 2>&1 || echo "⚠️  $tool not found: scanx needs it" >&2
done
if ! make --version 2>/dev/null | grep -q 'GNU Make [4-9]'; then
	echo "⚠️  'make' is not GNU make 4+. Install it (macOS: brew install make) and set SCANX_MAKE=gmake" >&2
fi
