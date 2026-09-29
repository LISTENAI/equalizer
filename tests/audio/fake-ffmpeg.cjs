const mode = process.argv[2];
if (mode === 'fail') { process.stderr.write('cannot decode fixture\n'); process.exitCode = 2; }
else if (mode === 'no-audio') { process.stderr.write('Stream map 0:a:0 matches no streams\n'); process.exitCode = 1; }
else if (mode === 'empty') { /* successful empty stream */ }
else if (mode === 'noisy' || mode === 'noisy-fail') {
  const block = Buffer.alloc(65536, 120);
  for (let i = 0; i < 64; ++i) process.stderr.write(block);
  if (mode === 'noisy') process.stdout.write(Buffer.from([1, 2, 3, 4]));
  else process.exitCode = 2;
} else if (mode === 'delayed') {
  setTimeout(() => { process.stdout.write(Buffer.from([1, 2])); }, 100);
  setTimeout(() => { process.stdout.write(Buffer.from([3, 4])); }, 250);
} else if (mode === 'hang') { setInterval(() => {}, 1000); }
else if (mode === 'truncated') { process.stdout.write(Buffer.from([1, 2, 3])); }
else { process.stdout.write(Buffer.from([1])); setTimeout(() => process.stdout.write(Buffer.from([2, 3, 4])), 10); }
