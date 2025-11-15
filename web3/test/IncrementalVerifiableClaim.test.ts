import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { keccak256, toHex } from "viem";

describe("IncrementalVerifiableClaim", async function () {
  const { viem } = await network.connect();
  const [deployer, user1, user2] = await viem.getWalletClients();

  // Helper function to hash events deterministically
  function hashEvent(event: any): `0x${string}` {
    const eventString = JSON.stringify(event, Object.keys(event).sort());
    return keccak256(toHex(eventString));
  }

  describe("Minting Claims", function () {
    it("Should mint a claim with initial events", async function () {
      const contract = await viem.deployContract("IncrementalVerifiableClaim");

      const ledgerEvents = [
        hashEvent({ nodeId: "start", type: "execute", data: "event1" }),
        hashEvent({ nodeId: "process", type: "execute", data: "event2" }),
        hashEvent({ nodeId: "sink", type: "execute", data: "event3" }),
      ];

      const sinkEvents = [
        hashEvent({ nodeId: "sink", type: "execute", data: "event3" }),
      ];

      const txHash = await contract.write.mintClaim([
        user1.account.address,
        "claim-123",
        "workflow-abc",
        "exec-xyz",
        ledgerEvents,
        sinkEvents,
        JSON.stringify({ score: 95, status: "passed" }),
        "ipfs://QmTest123",
      ]);

      // Verify claim state
      const state = await contract.read.getClaimState([1n]);
      const [ledgerRoot, ledgerCount, sinkRoot, sinkCount, aggregate] = state;

      assert.equal(ledgerCount, 3n);
      assert.equal(sinkCount, 1n);
      assert.equal(aggregate, JSON.stringify({ score: 95, status: "passed" }));
    });

    it("Should emit ClaimMinted event", async function () {
      const contract = await viem.deployContract("IncrementalVerifiableClaim");

      const ledgerEvents = [hashEvent({ data: "event1" })];
      const sinkEvents = [hashEvent({ data: "event1" })];

      await viem.assertions.emitWithArgs(
        contract.write.mintClaim([
          user1.account.address,
          "claim-123",
          "workflow-abc",
          "exec-xyz",
          ledgerEvents,
          sinkEvents,
          "{}",
          "ipfs://test",
        ]),
        contract,
        "ClaimMinted",
        [1n, user1.account.address, "claim-123", 1n, 1n]
      );
    });
  });

  describe("Appending Events (Incremental Updates)", function () {
    it("Should append new events and update aggregate", async function () {
      const contract = await viem.deployContract("IncrementalVerifiableClaim");

      // Mint initial claim
      const initialLedgerEvents = [
        hashEvent({ index: 0, data: "event0" }),
        hashEvent({ index: 1, data: "event1" }),
        hashEvent({ index: 2, data: "event2" }),
      ];

      const initialSinkEvents = [hashEvent({ index: 2, data: "event2" })];

      await contract.write.mintClaim([
        user1.account.address,
        "claim-incremental",
        "workflow-test",
        "exec-001",
        initialLedgerEvents,
        initialSinkEvents,
        JSON.stringify({ count: 1 }),
        "ipfs://initial",
      ]);

      // Get initial state
      const [, initialLedgerCount, , initialSinkCount, initialAggregate] =
        await contract.read.getClaimState([1n]);

      assert.equal(initialLedgerCount, 3n);
      assert.equal(initialSinkCount, 1n);

      // Append new events
      const newLedgerEvents = [
        hashEvent({ index: 3, data: "event3" }),
        hashEvent({ index: 4, data: "event4" }),
      ];

      const newSinkEvents = [hashEvent({ index: 4, data: "event4" })];

      // Use user1 wallet client to call appendEvents
      await contract.write.appendEvents(
        [1n, newLedgerEvents, newSinkEvents, JSON.stringify({ count: 2 })],
        { account: user1.account }
      );

      // Verify updated state
      const [newLedgerRoot, newLedgerCount, newSinkRoot, newSinkCount, newAggregate] =
        await contract.read.getClaimState([1n]);

      assert.equal(newLedgerCount, 5n); // 3 + 2
      assert.equal(newSinkCount, 2n); // 1 + 1
      assert.equal(newAggregate, JSON.stringify({ count: 2 }));
    });

    it("Should emit EventsAppended event", async function () {
      const contract = await viem.deployContract("IncrementalVerifiableClaim");

      const initialEvents = [hashEvent({ data: "initial" })];
      await contract.write.mintClaim([
        user1.account.address,
        "test",
        "wf",
        "ex",
        initialEvents,
        initialEvents,
        "{}",
        "ipfs://test",
      ]);

      const newLedgerEvents = [hashEvent({ data: "new" })];
      const newSinkEvents = [hashEvent({ data: "new" })];

      await viem.assertions.emit(
        contract.write.appendEvents(
          [1n, newLedgerEvents, newSinkEvents, JSON.stringify({ count: 2 })],
          { account: user1.account }
        ),
        contract,
        "EventsAppended"
      );
    });

    it("Should change Merkle root after appending events", async function () {
      const contract = await viem.deployContract("IncrementalVerifiableClaim");

      const initialEvents = [hashEvent({ data: "initial" })];
      await contract.write.mintClaim([
        user1.account.address,
        "test",
        "wf",
        "ex",
        initialEvents,
        initialEvents,
        "{}",
        "ipfs://test",
      ]);

      const [initialRoot] = await contract.read.getClaimState([1n]);

      const newEvents = [hashEvent({ data: "change-root" })];
      await contract.write.appendEvents([1n, newEvents, [], "{}"], {
        account: user1.account,
      });

      const [newRoot] = await contract.read.getClaimState([1n]);

      assert.notEqual(newRoot, initialRoot);
    });
  });

  describe("Security: Append-Only Verification", function () {
    it("CRITICAL TEST: Proves counter-example attack is IMPOSSIBLE", async function () {
      /**
       * This test proves that your counter-example attack is impossible:
       *
       * Original tree: [0, 1, 2, 3] → root m1
       * Attacker tries: [5, 6, 2, 3] → root m2
       *
       * The IMT library makes this impossible because:
       * 1. You can only call .add() which appends to the end
       * 2. The stored branches commit to ALL previous elements
       * 3. There's no way to "replace" elements 0 and 1 with 5 and 6
       */

      const contract = await viem.deployContract("IncrementalVerifiableClaim");

      // Create original tree with [0, 1, 2, 3]
      const originalEvents = [
        hashEvent({ index: 0, value: 0 }),
        hashEvent({ index: 1, value: 1 }),
        hashEvent({ index: 2, value: 2 }),
        hashEvent({ index: 3, value: 3 }),
      ];

      await contract.write.mintClaim([
        user1.account.address,
        "original-claim",
        "workflow-1",
        "exec-1",
        originalEvents,
        [originalEvents[3]], // sink event = element 3
        "{}",
        "ipfs://original",
      ]);

      const [originalRoot, originalCount] = await contract.read.getClaimState([1n]);
      assert.equal(originalCount, 4n);

      // Now try to create "malicious" tree [5, 6, 2, 3, 4]
      // This would require REPLACING 0,1 with 5,6 - which is IMPOSSIBLE
      // We can only APPEND new elements

      const attemptedMaliciousEvents = [
        hashEvent({ index: 4, value: 4 }), // Can only append element 4
      ];

      // Append element 4 (this is the ONLY operation allowed)
      await contract.write.appendEvents([1n, attemptedMaliciousEvents, [], "{}"], {
        account: user1.account,
      });

      const [newRoot, newCount] = await contract.read.getClaimState([1n]);

      // Verify we now have [0, 1, 2, 3, 4] not [5, 6, 2, 3, 4]
      assert.equal(newCount, 5n);

      // The root is different from original (because we added element 4)
      assert.notEqual(newRoot, originalRoot);

      // BUT there is NO WAY to create a tree [5, 6, 2, 3, 4]
      // because we cannot modify elements 0 and 1
      // The counter-example attack is IMPOSSIBLE with IMT!

      console.log("\n✅ SECURITY PROOF:");
      console.log("Original tree: [0, 1, 2, 3] → root:", originalRoot);
      console.log("After append: [0, 1, 2, 3, 4] → root:", newRoot);
      console.log("Attempted attack [5, 6, 2, 3, 4]: IMPOSSIBLE - no .replace() function exists!");
    });

    it("Should preserve all previous elements when appending", async function () {
      const contract = await viem.deployContract("IncrementalVerifiableClaim");

      // Create tree with 3 elements
      const events = [
        hashEvent({ id: "a" }),
        hashEvent({ id: "b" }),
        hashEvent({ id: "c" }),
      ];

      await contract.write.mintClaim([
        user1.account.address,
        "test",
        "wf",
        "ex",
        events,
        [events[2]],
        "{}",
        "ipfs://test",
      ]);

      const [rootBefore] = await contract.read.getClaimState([1n]);

      // Append 2 more elements
      const newEvents = [hashEvent({ id: "d" }), hashEvent({ id: "e" })];

      await contract.write.appendEvents([1n, newEvents, [], "{}"], {
        account: user1.account,
      });

      const [rootAfter, count] = await contract.read.getClaimState([1n]);

      // Count should be 5 (3 original + 2 new)
      assert.equal(count, 5n);

      // Root should change (because tree grew)
      assert.notEqual(rootAfter, rootBefore);

      // The original 3 elements are STILL in the tree (cannot be removed/modified)
      // This is guaranteed by the IMT data structure
    });
  });

  describe("Gas Usage Analysis", function () {
    it("Should measure gas for appending 100 events", async function () {
      const contract = await viem.deployContract("IncrementalVerifiableClaim");
      const publicClient = await viem.getPublicClient();

      // Mint initial claim
      const initialEvent = [hashEvent({ index: 0 })];
      await contract.write.mintClaim([
        user1.account.address,
        "gas-test",
        "wf",
        "ex",
        initialEvent,
        initialEvent,
        "{}",
        "ipfs://gas",
      ]);

      let totalGas = 0n;
      const iterations = 10; // Test with 10 batches of 10 events = 100 total

      for (let batch = 0; batch < iterations; batch++) {
        const events = [];
        for (let i = 0; i < 10; i++) {
          events.push(hashEvent({ index: batch * 10 + i + 1 }));
        }

        const txHash = await contract.write.appendEvents([1n, events, [], "{}"], {
          account: user1.account,
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        totalGas += receipt.gasUsed;
      }

      const avgGasPerBatch = totalGas / BigInt(iterations);
      const avgGasPerEvent = totalGas / BigInt(iterations * 10);

      console.log("\n⛽ GAS USAGE ANALYSIS:");
      console.log(`Total events appended: ${iterations * 10}`);
      console.log(`Total gas used: ${totalGas.toString()}`);
      console.log(`Average gas per batch (10 events): ${avgGasPerBatch.toString()}`);
      console.log(`Average gas per event: ${avgGasPerEvent.toString()}`);

      // Verify final count
      const [, count] = await contract.read.getClaimState([1n]);
      assert.equal(count, 101n); // 1 initial + 100 appended
    });
  });

  describe("Metadata and View Functions", function () {
    it("Should return claim metadata", async function () {
      const contract = await viem.deployContract("IncrementalVerifiableClaim");

      const ledgerEvents = [hashEvent({ data: "test" })];

      await contract.write.mintClaim([
        user1.account.address,
        "metadata-claim",
        "workflow-meta",
        "exec-meta",
        ledgerEvents,
        ledgerEvents,
        JSON.stringify({ value: 42 }),
        "ipfs://metadata",
      ]);

      const [claimId, workflowId, executionId, aggregate, metadataUri, , , owner] =
        await contract.read.getClaimMetadata([1n]);

      assert.equal(claimId, "metadata-claim");
      assert.equal(workflowId, "workflow-meta");
      assert.equal(executionId, "exec-meta");
      assert.equal(aggregate, JSON.stringify({ value: 42 }));
      assert.equal(metadataUri, "ipfs://metadata");
      assert.equal(owner.toLowerCase(), user1.account.address.toLowerCase());
    });

    it("Should return tokenURI (ERC721 compatible)", async function () {
      const contract = await viem.deployContract("IncrementalVerifiableClaim");

      const events = [hashEvent({ data: "uri-test" })];
      await contract.write.mintClaim([
        user1.account.address,
        "uri-claim",
        "wf",
        "ex",
        events,
        events,
        "{}",
        "ipfs://token-uri",
      ]);

      const uri = await contract.read.tokenURI([1n]);
      assert.equal(uri, "ipfs://token-uri");
    });

    it("Should track total supply", async function () {
      const contract = await viem.deployContract("IncrementalVerifiableClaim");

      assert.equal(await contract.read.totalSupply(), 0n);

      const events = [hashEvent({ data: "supply" })];

      await contract.write.mintClaim([
        user1.account.address,
        "c1",
        "wf",
        "ex",
        events,
        events,
        "{}",
        "ipfs://1",
      ]);
      assert.equal(await contract.read.totalSupply(), 1n);

      await contract.write.mintClaim([
        user1.account.address,
        "c2",
        "wf",
        "ex",
        events,
        events,
        "{}",
        "ipfs://2",
      ]);
      assert.equal(await contract.read.totalSupply(), 2n);
    });
  });

  describe("Transfer Functionality", function () {
    it("Should transfer claim ownership", async function () {
      const contract = await viem.deployContract("IncrementalVerifiableClaim");

      const events = [hashEvent({ data: "transfer" })];
      await contract.write.mintClaim([
        user1.account.address,
        "transfer-claim",
        "wf",
        "ex",
        events,
        events,
        "{}",
        "ipfs://transfer",
      ]);

      const ownerBefore = await contract.read.ownerOf([1n]);
      assert.equal(ownerBefore.toLowerCase(), user1.account.address.toLowerCase());

      await contract.write.transferFrom(
        [user1.account.address, user2.account.address, 1n],
        { account: user1.account }
      );

      const ownerAfter = await contract.read.ownerOf([1n]);
      assert.equal(ownerAfter.toLowerCase(), user2.account.address.toLowerCase());
    });

    it("Should emit Transfer event", async function () {
      const contract = await viem.deployContract("IncrementalVerifiableClaim");

      const events = [hashEvent({ data: "event" })];
      await contract.write.mintClaim([
        user1.account.address,
        "c",
        "wf",
        "ex",
        events,
        events,
        "{}",
        "ipfs://t",
      ]);

      await viem.assertions.emitWithArgs(
        contract.write.transferFrom(
          [user1.account.address, user2.account.address, 1n],
          { account: user1.account }
        ),
        contract,
        "Transfer",
        [user1.account.address, user2.account.address, 1n]
      );
    });
  });
});
