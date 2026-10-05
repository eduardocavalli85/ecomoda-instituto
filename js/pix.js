/**
 * Gerador de PIX "copia e cola" (BR Code estático, padrão EMV do Banco Central).
 * Roda 100% no navegador e não usa nenhuma credencial: só a chave PIX pública.
 */
(function () {
  function tlv(id, value) {
    var len = String(value.length).padStart(2, "0");
    return id + len + value;
  }

  // CRC16/CCITT-FALSE (poly 0x1021, init 0xFFFF), exigido pelo BR Code
  function crc16(str) {
    var crc = 0xffff;
    for (var i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (var j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }

  function semAcento(s) {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, "").toUpperCase();
  }

  /** @param {{chave:string, beneficiario:string, cidade:string}} pix
   *  @param {number} valor  em reais
   *  @param {string} txid   identificador do pedido (até 25 caracteres alfanuméricos) */
  function gerarPix(pix, valor, txid) {
    var conta = tlv("00", "br.gov.bcb.pix") + tlv("01", pix.chave);
    var payload =
      tlv("00", "01") +
      tlv("26", conta) +
      tlv("52", "0000") +
      tlv("53", "986") +
      tlv("54", valor.toFixed(2)) +
      tlv("58", "BR") +
      tlv("59", semAcento(pix.beneficiario).slice(0, 25)) +
      tlv("60", semAcento(pix.cidade).slice(0, 15)) +
      tlv("62", tlv("05", semAcento(txid).replace(/ /g, "").slice(0, 25) || "***")) +
      "6304";
    return payload + crc16(payload);
  }

  window.EcoPix = { gerarPix: gerarPix, crc16: crc16 };
})();
