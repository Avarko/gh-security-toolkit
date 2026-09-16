#!/bin/sh
# Remove the scanx link created by install.sh. The clone and the scan caches
# (~/.cache/gh-security-toolkit) are left alone; delete them by hand if wanted.

set -eu

home=$(cd -P -- "$(dirname -- "$0")" && pwd)
target="$home/bin/scanx"
bin_dir=${SCANX_BIN_DIR:-$HOME/.local/bin}
link="$bin_dir/scanx"

if [ -L "$link" ]; then
	current=$(readlink -- "$link")
	if [ "$current" = "$target" ]; then
		rm -f -- "$link"
		echo "Removed $link"
	else
		echo "uninstall.sh: $link points to $current, not this clone; left in place" >&2
		exit 1
	fi
elif [ -e "$link" ]; then
	echo "uninstall.sh: $link is not a symlink; left in place" >&2
	exit 1
else
	echo "scanx is not installed in $bin_dir"
fi
