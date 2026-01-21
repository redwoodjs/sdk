## Next Steps

- [ ] **Implement Hibernate Logic**
      Dynamically unload inactive objects from memory after inactivity. Matches Cloudflare's lifecycle management.
      Importance: 5
      Reference: [Cloudflare Hibernation API](https://developers.cloudflare.com/durable-objects/api/hibernation-api/)
- [x] **Implement `storage.transaction()`**
      Provide a transactional API wrapper for KV operations to ensure atomicity. Essential for consistency across multiple keys.
      Importance: 4
      Reference: [Durable Object Storage API (transaction)](https://developers.cloudflare.com/durable-objects/api/storage-api/#transaction)
- [ ] **Fully Implement `blockConcurrencyWhile`**
      Move from a stub to a working queue blocker during initialization or migrations. Ensures requests wait for critical setup.
      Importance: 4
      Reference: [Durable Object Storage API](https://developers.cloudflare.com/durable-objects/api/storage-api/#blockconcurrencywhile)
- [x] **Full `list()` Cursor Support**
      Implement `startAfter` in the KV listing API. Crucial for matching Cloudflare's performance characteristics in large datasets.
      Importance: 3
      Reference: [Durable Object Storage API (list)](https://developers.cloudflare.com/durable-objects/api/storage-api/#list)
- [x] **Storage Alarms**
      Add `setAlarm()` and `alarm()` handler support. Enables Durable Objects to schedule future background work.
      Importance: 3
      Reference: [Durable Object Alarms](https://developers.cloudflare.com/durable-objects/api/storage-api/#setalarm)
- [ ] **WebSocket Hibernation**
      Support transferring and managing WebSockets across process restarts. Reduces costs and improves resilience.
      Importance: 3
      Reference: [WebSocket Hibernation API](https://developers.cloudflare.com/durable-objects/api/websockets/)
- [ ] **Initialize `waitUntil` Support**
      Support extending the object lifetime for background work after a response is sent.
      Importance: 2
      Reference: [Durable Object State (waitUntil)](https://developers.cloudflare.com/durable-objects/api/state/#waituntil)
