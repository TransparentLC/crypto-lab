set -e

workdir=$(pwd)
tempdir=$(mktemp -d)
homedir=$(mktemp -d)
inputfile=$1
outputfile=$2

export PATH=/w/rust-standalone/bin:$PATH
export HOME=$homedir

rustc --version >&2

tar --zstd -xf rust-submission.tar.zst -C $tempdir
cp $inputfile "${tempdir}/rust-submission/src/main.rs"

cd "${tempdir}/rust-submission"
cargo build --release --features online_judge --jobs 1

cd $workdir
cp "${tempdir}/rust-submission/target/release/rust-submission" $outputfile

rm -rf $tempdir
rm -rf $homedir
